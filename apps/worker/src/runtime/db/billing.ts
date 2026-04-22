import { and, desc, eq, inArray } from "drizzle-orm"
import {
  CREDIT_LEDGER_ENTRY_TYPES,
  formatCreditsFromMilli,
} from "../lib/billing/openai-credit-pricing"
import {
  type BillingPlanKey,
  getAutoTopOffPackByLookupKey,
  getBillingPlanByKey,
} from "../lib/billing/plans"
import { getDb } from "./client"
import { getTenantCreditBalanceSummary } from "./credit-ledger"
import {
  billingAutoTopOffRuns,
  billingCheckoutSessions,
  billingCustomers,
  billingPreferences,
  billingSubscriptions,
  billingWebhookEvents,
  creditGrants,
  creditLedgerEntries,
  organizations,
  tenants,
} from "./schema"

type StripeCustomerRecordInput = {
  defaultCurrency?: string | null
  organizationId: string
  stripeCustomerId: string
}

type StripeSubscriptionRecordInput = {
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: Date | null
  currentPeriodStart: Date | null
  organizationId: string
  planKey: BillingPlanKey | null
  status: string
  stripeCustomerId: string
  stripePriceId: string | null
  stripeSubscriptionId: string
  trialEnd: Date | null
}

export type BillingPreferencesRecord = {
  autoTopOffEnabled: boolean
  minimumBalanceCredits: number
  monthlySpendLimitCents: number
  topOffAmountCents: number
}

export const DEFAULT_BILLING_PREFERENCES: BillingPreferencesRecord = {
  autoTopOffEnabled: false,
  minimumBalanceCredits: 2_000,
  monthlySpendLimitCents: 20_000,
  topOffAmountCents: 2_000,
}

export const AUTO_TOP_OFF_RUN_STATUSES = {
  awaitingWebhook: "awaiting_webhook",
  failed: "failed",
  processing: "processing",
  succeeded: "succeeded",
} as const

const AUTO_TOP_OFF_ACTIVE_RUN_STATUSES = [
  AUTO_TOP_OFF_RUN_STATUSES.processing,
  AUTO_TOP_OFF_RUN_STATUSES.awaitingWebhook,
] as const

const AUTO_TOP_OFF_ELIGIBLE_SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "trialing",
] as const

export type AutoTopOffRunStatus =
  (typeof AUTO_TOP_OFF_RUN_STATUSES)[keyof typeof AUTO_TOP_OFF_RUN_STATUSES]

export type BillingAutoTopOffExecutionTarget = {
  currentBalanceCreditsMilli: number
  currentPeriodEnd: Date | null
  currentPeriodStart: Date | null
  minimumBalanceCredits: number
  monthlySpendLimitCents: number
  organizationId: string
  stripeCustomerId: string
  stripeSubscriptionId: string | null
  tenantId: string
  topOffAmountCents: number
}

export type BillingCycleWindow = {
  end: Date | null
  start: Date
}

export type BillingAutoTopOffRunSummary = {
  completedAt: Date | null
  createdAt: Date
  creditsGrantedMilli: number
  failureReason: string | null
  status: AutoTopOffRunStatus
  stripeInvoiceId: string | null
  topOffAmountCents: number
}

function normalizeDate(value: Date | null | undefined) {
  return value ?? null
}

function startOfMonth(date: Date) {
  const next = new Date(date)
  next.setDate(1)
  next.setHours(0, 0, 0, 0)
  return next
}

export function getBillingCycleWindow(input: {
  currentPeriodEnd?: Date | null
  currentPeriodStart?: Date | null
  now?: Date
}): BillingCycleWindow {
  const now = input.now ?? new Date()

  if (input.currentPeriodStart) {
    return {
      end: input.currentPeriodEnd ?? null,
      start: input.currentPeriodStart,
    }
  }

  return {
    end: null,
    start: startOfMonth(now),
  }
}

export async function findBillingCustomerByOrganizationId(
  organizationId: string,
) {
  const db = getDb()
  const [customer] = await db
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.organizationId, organizationId))
    .limit(1)

  return customer ?? null
}

export async function findOrganizationIdByStripeCustomerId(
  stripeCustomerId: string,
) {
  const db = getDb()
  const [customer] = await db
    .select({
      organizationId: billingCustomers.organizationId,
    })
    .from(billingCustomers)
    .where(eq(billingCustomers.stripeCustomerId, stripeCustomerId))
    .limit(1)

  return customer?.organizationId ?? null
}

export async function upsertBillingCustomerRecord(
  input: StripeCustomerRecordInput,
) {
  const db = getDb()
  const now = new Date()

  const [record] = await db
    .insert(billingCustomers)
    .values({
      defaultCurrency: input.defaultCurrency ?? "usd",
      organizationId: input.organizationId,
      stripeCustomerId: input.stripeCustomerId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        defaultCurrency: input.defaultCurrency ?? "usd",
        updatedAt: now,
      },
      target: billingCustomers.organizationId,
    })
    .returning()

  return record ?? null
}

export async function findBillingSubscriptionByOrganizationId(
  organizationId: string,
) {
  const db = getDb()
  const [subscription] = await db
    .select()
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.organizationId, organizationId))
    .limit(1)

  return subscription ?? null
}

export async function getBillingPreferencesByOrganizationId(
  organizationId: string,
) {
  const db = getDb()
  const [preferences] = await db
    .select()
    .from(billingPreferences)
    .where(eq(billingPreferences.organizationId, organizationId))
    .limit(1)

  return preferences ?? null
}

export async function upsertBillingPreferences(input: {
  organizationId: string
  preferences: BillingPreferencesRecord
}) {
  const db = getDb()
  const now = new Date()

  const [record] = await db
    .insert(billingPreferences)
    .values({
      autoTopOffEnabled: input.preferences.autoTopOffEnabled,
      minimumBalanceCredits: input.preferences.minimumBalanceCredits,
      monthlySpendLimitCents: input.preferences.monthlySpendLimitCents,
      organizationId: input.organizationId,
      topOffAmountCents: input.preferences.topOffAmountCents,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        autoTopOffEnabled: input.preferences.autoTopOffEnabled,
        minimumBalanceCredits: input.preferences.minimumBalanceCredits,
        monthlySpendLimitCents: input.preferences.monthlySpendLimitCents,
        topOffAmountCents: input.preferences.topOffAmountCents,
        updatedAt: now,
      },
      target: billingPreferences.organizationId,
    })
    .returning()

  return record ?? null
}

export async function upsertBillingSubscriptionRecord(
  input: StripeSubscriptionRecordInput,
) {
  const db = getDb()
  const now = new Date()

  const [record] = await db
    .insert(billingSubscriptions)
    .values({
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      currentPeriodEnd: normalizeDate(input.currentPeriodEnd),
      currentPeriodStart: normalizeDate(input.currentPeriodStart),
      organizationId: input.organizationId,
      planKey: input.planKey,
      status: input.status,
      stripeCustomerId: input.stripeCustomerId,
      stripePriceId: input.stripePriceId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      trialEnd: normalizeDate(input.trialEnd),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        currentPeriodEnd: normalizeDate(input.currentPeriodEnd),
        currentPeriodStart: normalizeDate(input.currentPeriodStart),
        planKey: input.planKey,
        status: input.status,
        stripeCustomerId: input.stripeCustomerId,
        stripePriceId: input.stripePriceId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        trialEnd: normalizeDate(input.trialEnd),
        updatedAt: now,
      },
      target: billingSubscriptions.organizationId,
    })
    .returning()

  return record ?? null
}

export async function recordBillingCheckoutSession(input: {
  checkoutUrl: string | null
  mode: string
  organizationId: string
  planKey: BillingPlanKey | null
  status: string
  stripeCheckoutSessionId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}) {
  const db = getDb()
  const now = new Date()

  const [record] = await db
    .insert(billingCheckoutSessions)
    .values({
      checkoutUrl: input.checkoutUrl,
      mode: input.mode,
      organizationId: input.organizationId,
      planKey: input.planKey,
      status: input.status,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        checkoutUrl: input.checkoutUrl,
        planKey: input.planKey,
        status: input.status,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        updatedAt: now,
      },
      target: billingCheckoutSessions.stripeCheckoutSessionId,
    })
    .returning()

  return record ?? null
}

export async function markStripeWebhookEventProcessed(input: {
  eventType: string
  stripeEventId: string
}) {
  const db = getDb()
  const now = new Date()

  const [record] = await db
    .insert(billingWebhookEvents)
    .values({
      eventType: input.eventType,
      processedAt: now,
      stripeEventId: input.stripeEventId,
    })
    .onConflictDoNothing({
      target: billingWebhookEvents.stripeEventId,
    })
    .returning({
      id: billingWebhookEvents.id,
    })

  return Boolean(record)
}

export async function hasProcessedStripeWebhookEvent(stripeEventId: string) {
  const db = getDb()
  const [event] = await db
    .select({
      id: billingWebhookEvents.id,
    })
    .from(billingWebhookEvents)
    .where(eq(billingWebhookEvents.stripeEventId, stripeEventId))
    .limit(1)

  return Boolean(event)
}

export async function getOrganizationTenantForBilling(organizationId: string) {
  const db = getDb()
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
    })
    .from(tenants)
    .where(eq(tenants.organizationId, organizationId))
    .orderBy(desc(tenants.createdAt))
    .limit(1)

  return tenant ?? null
}

export async function listBillingAutoTopOffExecutionTargets() {
  const db = getDb()
  const rows = await db
    .select({
      currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
      currentPeriodStart: billingSubscriptions.currentPeriodStart,
      minimumBalanceCredits: billingPreferences.minimumBalanceCredits,
      monthlySpendLimitCents: billingPreferences.monthlySpendLimitCents,
      organizationId: billingPreferences.organizationId,
      stripeCustomerId: billingCustomers.stripeCustomerId,
      stripeSubscriptionId: billingSubscriptions.stripeSubscriptionId,
      topOffAmountCents: billingPreferences.topOffAmountCents,
    })
    .from(billingPreferences)
    .innerJoin(
      billingCustomers,
      eq(billingCustomers.organizationId, billingPreferences.organizationId),
    )
    .innerJoin(
      billingSubscriptions,
      eq(
        billingSubscriptions.organizationId,
        billingPreferences.organizationId,
      ),
    )
    .where(
      and(
        eq(billingPreferences.autoTopOffEnabled, true),
        inArray(
          billingSubscriptions.status,
          AUTO_TOP_OFF_ELIGIBLE_SUBSCRIPTION_STATUSES,
        ),
      ),
    )

  const targets: BillingAutoTopOffExecutionTarget[] = []

  for (const row of rows) {
    const tenant = await getOrganizationTenantForBilling(row.organizationId)

    if (!tenant) {
      continue
    }

    const balance = await getTenantCreditBalanceSummary({
      tenantId: tenant.id,
    })

    targets.push({
      currentBalanceCreditsMilli: balance.currentBalanceCreditsMilli,
      currentPeriodEnd: row.currentPeriodEnd,
      currentPeriodStart: row.currentPeriodStart,
      minimumBalanceCredits: row.minimumBalanceCredits,
      monthlySpendLimitCents: row.monthlySpendLimitCents,
      organizationId: row.organizationId,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      tenantId: tenant.id,
      topOffAmountCents: row.topOffAmountCents,
    })
  }

  return targets
}

export async function getBillingAutoTopOffExecutionTargetByOrganizationId(
  organizationId: string,
) {
  const targets = await listBillingAutoTopOffExecutionTargets()
  return (
    targets.find((target) => target.organizationId === organizationId) ?? null
  )
}

export async function findLatestBillingAutoTopOffRunByOrganizationId(
  organizationId: string,
) {
  const db = getDb()
  const [run] = await db
    .select({
      completedAt: billingAutoTopOffRuns.completedAt,
      createdAt: billingAutoTopOffRuns.createdAt,
      creditsGrantedMilli: billingAutoTopOffRuns.creditsGrantedMilli,
      failureReason: billingAutoTopOffRuns.failureReason,
      status: billingAutoTopOffRuns.status,
      stripeInvoiceId: billingAutoTopOffRuns.stripeInvoiceId,
      topOffAmountCents: billingAutoTopOffRuns.topOffAmountCents,
    })
    .from(billingAutoTopOffRuns)
    .where(eq(billingAutoTopOffRuns.organizationId, organizationId))
    .orderBy(desc(billingAutoTopOffRuns.createdAt))
    .limit(1)

  return (run ?? null) as BillingAutoTopOffRunSummary | null
}

export async function hasActiveBillingAutoTopOffRun(organizationId: string) {
  const db = getDb()
  const [run] = await db
    .select({
      id: billingAutoTopOffRuns.id,
    })
    .from(billingAutoTopOffRuns)
    .where(
      and(
        eq(billingAutoTopOffRuns.organizationId, organizationId),
        inArray(billingAutoTopOffRuns.status, AUTO_TOP_OFF_ACTIVE_RUN_STATUSES),
      ),
    )
    .orderBy(desc(billingAutoTopOffRuns.createdAt))
    .limit(1)

  return Boolean(run)
}

export async function createBillingAutoTopOffRun(input: {
  creditsGrantedMilli: number
  monthlySpendLimitCents: number
  organizationId: string
  status: AutoTopOffRunStatus
  stripeCustomerId: string
  stripeIdempotencyKey: string
  tenantId: string
  topOffAmountCents: number
  triggerBalanceCreditsMilli: number
}) {
  const db = getDb()
  const now = new Date()
  const [run] = await db
    .insert(billingAutoTopOffRuns)
    .values({
      completedAt:
        input.status === AUTO_TOP_OFF_RUN_STATUSES.failed ||
        input.status === AUTO_TOP_OFF_RUN_STATUSES.succeeded
          ? now
          : null,
      creditsGrantedMilli: input.creditsGrantedMilli,
      monthlySpendLimitCents: input.monthlySpendLimitCents,
      organizationId: input.organizationId,
      processedAt:
        input.status === AUTO_TOP_OFF_RUN_STATUSES.processing ? now : null,
      status: input.status,
      stripeCustomerId: input.stripeCustomerId,
      stripeIdempotencyKey: input.stripeIdempotencyKey,
      tenantId: input.tenantId,
      topOffAmountCents: input.topOffAmountCents,
      triggerBalanceCreditsMilli: input.triggerBalanceCreditsMilli,
      updatedAt: now,
    })
    .returning()

  return run ?? null
}

export async function updateBillingAutoTopOffRunToAwaitingWebhook(input: {
  runId: string
  stripeInvoiceId: string
  stripeInvoiceItemId: string | null
  stripePriceId: string
  stripePriceLookupKey: string
}) {
  const db = getDb()
  const [run] = await db
    .update(billingAutoTopOffRuns)
    .set({
      processedAt: new Date(),
      status: AUTO_TOP_OFF_RUN_STATUSES.awaitingWebhook,
      stripeInvoiceId: input.stripeInvoiceId,
      stripeInvoiceItemId: input.stripeInvoiceItemId,
      stripePriceId: input.stripePriceId,
      stripePriceLookupKey: input.stripePriceLookupKey,
      updatedAt: new Date(),
    })
    .where(eq(billingAutoTopOffRuns.id, input.runId))
    .returning({
      id: billingAutoTopOffRuns.id,
    })

  return run ?? null
}

export async function markBillingAutoTopOffRunFailed(input: {
  reason: string
  runId: string
  stripeInvoiceId?: string | null
}) {
  const db = getDb()
  const [run] = await db
    .update(billingAutoTopOffRuns)
    .set({
      completedAt: new Date(),
      failureReason: input.reason,
      status: AUTO_TOP_OFF_RUN_STATUSES.failed,
      stripeInvoiceId: input.stripeInvoiceId ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(billingAutoTopOffRuns.id, input.runId))
    .returning({
      id: billingAutoTopOffRuns.id,
    })

  return run ?? null
}

export async function markBillingAutoTopOffRunFailedByInvoiceId(input: {
  reason: string
  stripeInvoiceId: string
}) {
  const db = getDb()
  const [run] = await db
    .update(billingAutoTopOffRuns)
    .set({
      completedAt: new Date(),
      failureReason: input.reason,
      status: AUTO_TOP_OFF_RUN_STATUSES.failed,
      updatedAt: new Date(),
    })
    .where(eq(billingAutoTopOffRuns.stripeInvoiceId, input.stripeInvoiceId))
    .returning({
      id: billingAutoTopOffRuns.id,
    })

  return run ?? null
}

export async function markBillingAutoTopOffRunSucceededByInvoiceId(input: {
  stripeInvoiceId: string
}) {
  const db = getDb()
  const [run] = await db
    .update(billingAutoTopOffRuns)
    .set({
      completedAt: new Date(),
      failureReason: null,
      status: AUTO_TOP_OFF_RUN_STATUSES.succeeded,
      updatedAt: new Date(),
    })
    .where(eq(billingAutoTopOffRuns.stripeInvoiceId, input.stripeInvoiceId))
    .returning({
      id: billingAutoTopOffRuns.id,
    })

  return run ?? null
}

export async function createSubscriptionCreditGrant(input: {
  creditsGrantedMilli: number
  expiresAt: Date | null
  organizationId: string
  planKey: BillingPlanKey
  stripeInvoiceId: string
}) {
  const db = getDb()
  const tenant = await getOrganizationTenantForBilling(input.organizationId)

  if (!tenant) {
    throw new Error(
      "Cannot grant subscription credits because the workspace has no tenant.",
    )
  }

  const plan = getBillingPlanByKey(input.planKey)

  if (!plan) {
    throw new Error(`Unknown billing plan key: ${input.planKey}`)
  }

  return db.transaction(async (tx) => {
    const [grant] = await tx
      .insert(creditGrants)
      .values({
        creditsGrantedMilli: input.creditsGrantedMilli,
        expiresAt: input.expiresAt,
        organizationId: input.organizationId,
        planKey: input.planKey,
        sourceExternalId: input.stripeInvoiceId,
        sourceType: "stripe_invoice",
        tenantId: tenant.id,
      })
      .onConflictDoNothing({
        target: [creditGrants.sourceType, creditGrants.sourceExternalId],
      })
      .returning({
        creditsGrantedMilli: creditGrants.creditsGrantedMilli,
        id: creditGrants.id,
        tenantId: creditGrants.tenantId,
      })

    if (!grant) {
      return {
        created: false,
        creditGrantId: null,
        tenantId: tenant.id,
      }
    }

    const [ledgerEntry] = await tx
      .insert(creditLedgerEntries)
      .values({
        billableUnits: 0,
        creditsDeltaMilli: grant.creditsGrantedMilli,
        description: `${plan.name} monthly credits from Stripe invoice ${input.stripeInvoiceId} (${formatCreditsFromMilli(grant.creditsGrantedMilli)} credits)`,
        entryType: CREDIT_LEDGER_ENTRY_TYPES.subscriptionGrant,
        sourceId: grant.id,
        sourceType: "credit_grant",
        tenantId: grant.tenantId ?? tenant.id,
      })
      .returning({
        id: creditLedgerEntries.id,
      })

    await tx
      .update(creditGrants)
      .set({
        ledgerEntryId: ledgerEntry?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(creditGrants.id, grant.id))

    return {
      created: true,
      creditGrantId: grant.id,
      tenantId: tenant.id,
    }
  })
}

export async function createTopUpCreditGrant(input: {
  creditsGrantedMilli: number
  lookupKey: string
  organizationId: string
  stripeInvoiceId: string
}) {
  const db = getDb()
  const tenant = await getOrganizationTenantForBilling(input.organizationId)

  if (!tenant) {
    throw new Error(
      "Cannot grant top-up credits because the workspace has no tenant.",
    )
  }

  const pack = getAutoTopOffPackByLookupKey(input.lookupKey)

  if (!pack) {
    throw new Error(`Unknown top-up lookup key: ${input.lookupKey}`)
  }

  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  return db.transaction(async (tx) => {
    const [grant] = await tx
      .insert(creditGrants)
      .values({
        creditsGrantedMilli: input.creditsGrantedMilli,
        expiresAt,
        organizationId: input.organizationId,
        planKey: null,
        sourceExternalId: input.stripeInvoiceId,
        sourceType: "stripe_top_up_invoice",
        tenantId: tenant.id,
      })
      .onConflictDoNothing({
        target: [creditGrants.sourceType, creditGrants.sourceExternalId],
      })
      .returning({
        creditsGrantedMilli: creditGrants.creditsGrantedMilli,
        id: creditGrants.id,
        tenantId: creditGrants.tenantId,
      })

    if (!grant) {
      return {
        created: false,
        creditGrantId: null,
        tenantId: tenant.id,
      }
    }

    const [ledgerEntry] = await tx
      .insert(creditLedgerEntries)
      .values({
        billableUnits: 0,
        creditsDeltaMilli: grant.creditsGrantedMilli,
        description: `${pack.label} credits from Stripe invoice ${input.stripeInvoiceId} (${formatCreditsFromMilli(grant.creditsGrantedMilli)} credits)`,
        entryType: CREDIT_LEDGER_ENTRY_TYPES.topUpGrant,
        sourceId: grant.id,
        sourceType: "credit_grant",
        tenantId: grant.tenantId ?? tenant.id,
      })
      .returning({
        id: creditLedgerEntries.id,
      })

    await tx
      .update(creditGrants)
      .set({
        ledgerEntryId: ledgerEntry?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(creditGrants.id, grant.id))

    return {
      created: true,
      creditGrantId: grant.id,
      tenantId: tenant.id,
    }
  })
}

export async function getWorkspaceBillingOverview(input: {
  organizationId: string
}) {
  const db = getDb()

  const [organization, subscription, customer, preferences, tenant] =
    await Promise.all([
      db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      findBillingSubscriptionByOrganizationId(input.organizationId),
      findBillingCustomerByOrganizationId(input.organizationId),
      getBillingPreferencesByOrganizationId(input.organizationId),
      getOrganizationTenantForBilling(input.organizationId),
    ])

  const balance = tenant
    ? await getTenantCreditBalanceSummary({ tenantId: tenant.id })
    : {
        currentBalanceCreditsMilli: 0,
        latestEntryCreatedAt: null,
        totalDebitedCreditsMilli: 0,
        totalGrantedCreditsMilli: 0,
      }

  const recentGrants = await db
    .select({
      creditsGrantedMilli: creditGrants.creditsGrantedMilli,
      expiresAt: creditGrants.expiresAt,
      grantedAt: creditGrants.grantedAt,
      id: creditGrants.id,
      planKey: creditGrants.planKey,
      sourceType: creditGrants.sourceType,
    })
    .from(creditGrants)
    .where(eq(creditGrants.organizationId, input.organizationId))
    .orderBy(desc(creditGrants.grantedAt))
    .limit(10)

  const recentLedgerEntries = tenant
    ? await db
        .select({
          createdAt: creditLedgerEntries.createdAt,
          creditsDeltaMilli: creditLedgerEntries.creditsDeltaMilli,
          description: creditLedgerEntries.description,
          entryType: creditLedgerEntries.entryType,
          id: creditLedgerEntries.id,
        })
        .from(creditLedgerEntries)
        .where(eq(creditLedgerEntries.tenantId, tenant.id))
        .orderBy(desc(creditLedgerEntries.createdAt))
        .limit(12)
    : []

  const latestAutoTopOffRun =
    await findLatestBillingAutoTopOffRunByOrganizationId(input.organizationId)

  return {
    autoTopOff: {
      latestRun: latestAutoTopOffRun,
    },
    balance,
    customer,
    organization,
    preferences: preferences ?? DEFAULT_BILLING_PREFERENCES,
    recentGrants,
    recentLedgerEntries,
    subscription,
    tenant,
  }
}

export function buildSubscriptionRecordFromStripe(input: {
  organizationId: string
  subscription: {
    cancel_at_period_end: boolean
    current_period_end: number | null
    current_period_start: number | null
    customer: string
    items: Array<{
      price: {
        id: string
        lookupKey: string | null
      } | null
    }>
    status: string
    trial_end: number | null
    id: string
  }
}) {
  const stripePrice = input.subscription.items[0]?.price ?? null
  const stripePriceId = stripePrice?.id ?? null
  const plan = stripePrice?.lookupKey
    ? getBillingPlanByKey(stripePrice.lookupKey)
    : null

  return {
    cancelAtPeriodEnd: input.subscription.cancel_at_period_end,
    currentPeriodEnd: input.subscription.current_period_end
      ? new Date(input.subscription.current_period_end * 1000)
      : null,
    currentPeriodStart: input.subscription.current_period_start
      ? new Date(input.subscription.current_period_start * 1000)
      : null,
    organizationId: input.organizationId,
    planKey: plan?.key ?? null,
    status: input.subscription.status,
    stripeCustomerId: input.subscription.customer,
    stripePriceId,
    stripeSubscriptionId: input.subscription.id,
    trialEnd: input.subscription.trial_end
      ? new Date(input.subscription.trial_end * 1000)
      : null,
  } satisfies StripeSubscriptionRecordInput
}

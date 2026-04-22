import { getDb } from "@otto/feature-integrations-runtime/db/client"
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
} from "@otto/feature-integrations-runtime/db/schema"
import { desc, eq, sql } from "drizzle-orm"

import {
  CREDIT_LEDGER_ENTRY_TYPES,
  formatCreditsFromMilli,
} from "./credit-pricing"
import {
  type BillingPlanKey,
  getAutoTopOffPackByLookupKey,
  getBillingPlanByKey,
  getBillingPlans,
} from "./plans"

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

export const INITIAL_WORKSPACE_CREDITS = 1_000
const INITIAL_WORKSPACE_CREDIT_GRANT_SOURCE_TYPE = "workspace_initial_grant"

export type BillingAutoTopOffRunSummary = {
  completedAt: Date | null
  createdAt: Date
  creditsGrantedMilli: number
  failureReason: string | null
  status: string
  stripeInvoiceId: string | null
  topOffAmountCents: number
}

export type BillingCycleWindow = {
  end: Date | null
  start: Date
}

export function buildInitialWorkspaceCreditGrantInput(input: {
  tenantId: string
}) {
  return {
    creditsDeltaMilli: INITIAL_WORKSPACE_CREDITS * 1_000,
    description: `Initial workspace credits (${INITIAL_WORKSPACE_CREDITS} credits)`,
    sourceId: input.tenantId,
    sourceType: INITIAL_WORKSPACE_CREDIT_GRANT_SOURCE_TYPE,
  }
}

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

function normalizeDate(value: Date | null | undefined) {
  return value ?? null
}

function startOfMonth(date: Date) {
  const next = new Date(date)
  next.setDate(1)
  next.setHours(0, 0, 0, 0)
  return next
}

function numberFromValue(value: unknown) {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function dateFromValue(value: unknown) {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

async function getTenantCreditBalanceSummary(input: { tenantId: string }) {
  const db = getDb()
  const [summary] = await db
    .select({
      currentBalanceCreditsMilli: sql`coalesce(sum(${creditLedgerEntries.creditsDeltaMilli}), 0)`,
      latestEntryCreatedAt: sql<Date | null>`max(${creditLedgerEntries.createdAt})`,
      totalDebitedCreditsMilli: sql`coalesce(sum(case when ${creditLedgerEntries.creditsDeltaMilli} < 0 then -${creditLedgerEntries.creditsDeltaMilli} else 0 end), 0)`,
      totalGrantedCreditsMilli: sql`coalesce(sum(case when ${creditLedgerEntries.creditsDeltaMilli} > 0 then ${creditLedgerEntries.creditsDeltaMilli} else 0 end), 0)`,
    })
    .from(creditLedgerEntries)
    .where(eq(creditLedgerEntries.tenantId, input.tenantId))

  return {
    currentBalanceCreditsMilli: numberFromValue(
      summary?.currentBalanceCreditsMilli,
    ),
    latestEntryCreatedAt: dateFromValue(summary?.latestEntryCreatedAt),
    totalDebitedCreditsMilli: numberFromValue(
      summary?.totalDebitedCreditsMilli,
    ),
    totalGrantedCreditsMilli: numberFromValue(
      summary?.totalGrantedCreditsMilli,
    ),
  }
}

async function getOrganizationTenantForBilling(organizationId: string) {
  const db = getDb()
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
    })
    .from(tenants)
    .where(eq(tenants.organizationId, organizationId))
    .limit(1)

  return tenant ?? null
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

export async function ensureInitialWorkspaceCredits(input: {
  tenantId: string
}) {
  const db = getDb()
  const grantInput = buildInitialWorkspaceCreditGrantInput(input)
  const [ledgerEntry] = await db
    .insert(creditLedgerEntries)
    .values({
      billableUnits: 0,
      creditsDeltaMilli: grantInput.creditsDeltaMilli,
      description: grantInput.description,
      entryType: CREDIT_LEDGER_ENTRY_TYPES.manualGrant,
      sourceId: grantInput.sourceId,
      sourceType: grantInput.sourceType,
      tenantId: input.tenantId,
    })
    .onConflictDoNothing({
      target: [
        creditLedgerEntries.sourceType,
        creditLedgerEntries.sourceId,
        creditLedgerEntries.entryType,
      ],
    })
    .returning({
      id: creditLedgerEntries.id,
    })

  return ledgerEntry?.id ?? null
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

  const latestAutoTopOffRun =
    await findLatestBillingAutoTopOffRunByOrganizationId(input.organizationId)

  return {
    autoTopOff: {
      latestRun: latestAutoTopOffRun,
    },
    balance,
    customer,
    organization,
    plans: getBillingPlans(),
    preferences: preferences ?? DEFAULT_BILLING_PREFERENCES,
    subscription,
    tenant,
  }
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
  const [record] = await db
    .insert(billingWebhookEvents)
    .values({
      eventType: input.eventType,
      processedAt: new Date(),
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
      status: "failed",
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
      status: "succeeded",
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

export function buildSubscriptionRecordFromStripe(input: {
  organizationId: string
  subscription: {
    cancel_at_period_end: boolean
    current_period_end: number | null
    current_period_start: number | null
    customer: string
    id: string
    items: Array<{
      price: {
        id: string
        lookupKey: string | null
      } | null
    }>
    status: string
    trial_end: number | null
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

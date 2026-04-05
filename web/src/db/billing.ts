import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { getTenantCreditBalanceSummary } from "@/db/credit-ledger";
import {
  billingCheckoutSessions,
  billingCustomers,
  billingSubscriptions,
  billingWebhookEvents,
  creditGrants,
  creditLedgerEntries,
  organizations,
  tenants,
} from "@/db/schema";
import {
  CREDIT_LEDGER_ENTRY_TYPES,
  formatCreditsFromMilli,
} from "@/lib/billing/openai-credit-pricing";
import { type BillingPlanKey, getBillingPlanByKey } from "@/lib/billing/plans";

type StripeCustomerRecordInput = {
  defaultCurrency?: string | null;
  organizationId: string;
  stripeCustomerId: string;
};

type StripeSubscriptionRecordInput = {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  currentPeriodStart: Date | null;
  organizationId: string;
  planKey: BillingPlanKey | null;
  status: string;
  stripeCustomerId: string;
  stripePriceId: string | null;
  stripeSubscriptionId: string;
  trialEnd: Date | null;
};

function normalizeDate(value: Date | null | undefined) {
  return value ?? null;
}

export async function findBillingCustomerByOrganizationId(
  organizationId: string,
) {
  const db = getDb();
  const [customer] = await db
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.organizationId, organizationId))
    .limit(1);

  return customer ?? null;
}

export async function findOrganizationIdByStripeCustomerId(
  stripeCustomerId: string,
) {
  const db = getDb();
  const [customer] = await db
    .select({
      organizationId: billingCustomers.organizationId,
    })
    .from(billingCustomers)
    .where(eq(billingCustomers.stripeCustomerId, stripeCustomerId))
    .limit(1);

  return customer?.organizationId ?? null;
}

export async function upsertBillingCustomerRecord(
  input: StripeCustomerRecordInput,
) {
  const db = getDb();
  const now = new Date();

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
    .returning();

  return record ?? null;
}

export async function findBillingSubscriptionByOrganizationId(
  organizationId: string,
) {
  const db = getDb();
  const [subscription] = await db
    .select()
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.organizationId, organizationId))
    .limit(1);

  return subscription ?? null;
}

export async function upsertBillingSubscriptionRecord(
  input: StripeSubscriptionRecordInput,
) {
  const db = getDb();
  const now = new Date();

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
    .returning();

  return record ?? null;
}

export async function recordBillingCheckoutSession(input: {
  checkoutUrl: string | null;
  mode: string;
  organizationId: string;
  planKey: BillingPlanKey | null;
  status: string;
  stripeCheckoutSessionId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}) {
  const db = getDb();
  const now = new Date();

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
    .returning();

  return record ?? null;
}

export async function markStripeWebhookEventProcessed(input: {
  eventType: string;
  stripeEventId: string;
}) {
  const db = getDb();
  const now = new Date();

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
    });

  return Boolean(record);
}

export async function hasProcessedStripeWebhookEvent(stripeEventId: string) {
  const db = getDb();
  const [event] = await db
    .select({
      id: billingWebhookEvents.id,
    })
    .from(billingWebhookEvents)
    .where(eq(billingWebhookEvents.stripeEventId, stripeEventId))
    .limit(1);

  return Boolean(event);
}

export async function getOrganizationTenantForBilling(organizationId: string) {
  const db = getDb();
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
    })
    .from(tenants)
    .where(eq(tenants.organizationId, organizationId))
    .orderBy(desc(tenants.createdAt))
    .limit(1);

  return tenant ?? null;
}

export async function createSubscriptionCreditGrant(input: {
  creditsGrantedMilli: number;
  expiresAt: Date | null;
  organizationId: string;
  planKey: BillingPlanKey;
  stripeInvoiceId: string;
}) {
  const db = getDb();
  const tenant = await getOrganizationTenantForBilling(input.organizationId);

  if (!tenant) {
    throw new Error(
      "Cannot grant subscription credits because the workspace has no tenant.",
    );
  }

  const plan = getBillingPlanByKey(input.planKey);

  if (!plan) {
    throw new Error(`Unknown billing plan key: ${input.planKey}`);
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
      });

    if (!grant) {
      return {
        created: false,
        creditGrantId: null,
        tenantId: tenant.id,
      };
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
      });

    await tx
      .update(creditGrants)
      .set({
        ledgerEntryId: ledgerEntry?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(creditGrants.id, grant.id));

    return {
      created: true,
      creditGrantId: grant.id,
      tenantId: tenant.id,
    };
  });
}

export async function getWorkspaceBillingOverview(input: {
  organizationId: string;
}) {
  const db = getDb();

  const [organization, subscription, customer, tenant] = await Promise.all([
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
    getOrganizationTenantForBilling(input.organizationId),
  ]);

  const balance = tenant
    ? await getTenantCreditBalanceSummary({ tenantId: tenant.id })
    : {
        currentBalanceCreditsMilli: 0,
        latestEntryCreatedAt: null,
        totalDebitedCreditsMilli: 0,
        totalGrantedCreditsMilli: 0,
      };

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
    .limit(10);

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
    : [];

  return {
    balance,
    customer,
    organization,
    recentGrants,
    recentLedgerEntries,
    subscription,
    tenant,
  };
}

export function buildSubscriptionRecordFromStripe(input: {
  organizationId: string;
  subscription: {
    cancel_at_period_end: boolean;
    current_period_end: number | null;
    current_period_start: number | null;
    customer: string;
    items: Array<{
      price: {
        id: string;
        lookupKey: string | null;
      } | null;
    }>;
    status: string;
    trial_end: number | null;
    id: string;
  };
}) {
  const stripePrice = input.subscription.items[0]?.price ?? null;
  const stripePriceId = stripePrice?.id ?? null;
  const plan = stripePrice?.lookupKey
    ? getBillingPlanByKey(stripePrice.lookupKey)
    : null;

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
  } satisfies StripeSubscriptionRecordInput;
}

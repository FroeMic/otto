import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  AUTO_TOP_OFF_RUN_STATUSES,
  createBillingAutoTopOffRun,
  findLatestBillingAutoTopOffRunByOrganizationId,
  getBillingAutoTopOffExecutionTargetByOrganizationId,
  getBillingAutoTopOffMonthlySpendCents,
  hasActiveBillingAutoTopOffRun,
  listBillingAutoTopOffExecutionTargets,
  markBillingAutoTopOffRunFailed,
  updateBillingAutoTopOffRunToAwaitingWebhook,
} from "@/db/billing";
import { jobRuns } from "@/db/schema";
import { getAutoTopOffPackByAmountCents } from "@/lib/billing/plans";
import {
  getStripe,
  getStripeOneTimePriceIdForTopUpLookupKey,
} from "@/lib/billing/stripe";

import {
  appendJobEvent,
  enqueueJob,
  markJobFailed,
  markJobSucceeded,
} from "./queue";
import {
  type ClaimedJob,
  JOB_STATUSES,
  JOB_TYPES,
  type ExecuteBillingAutoTopOffPayload,
} from "./types";

const AUTO_TOP_OFF_SCAN_INTERVAL_MS = 30_000;
const AUTO_TOP_OFF_FAILURE_COOLDOWN_MS = 60 * 60 * 1000;

const AUTO_TOP_OFF_EVENTS = {
  awaitingWebhook: "awaiting_webhook",
  charged: "charged",
  charging: "charging",
  eligible: "eligible",
  failed: "auto_top_off_failed",
  skipped: "auto_top_off_skipped",
  succeeded: "auto_top_off_succeeded",
} as const;

let nextAutoTopOffScanAt = 0;

export async function runAutoTopOffEnqueueCycle() {
  const now = Date.now();

  if (now < nextAutoTopOffScanAt) {
    return 0;
  }

  nextAutoTopOffScanAt = now + AUTO_TOP_OFF_SCAN_INTERVAL_MS;

  const targets = await listBillingAutoTopOffExecutionTargets();
  let queuedCount = 0;

  for (const target of targets) {
    const thresholdCreditsMilli = target.minimumBalanceCredits * 1_000;

    if (target.currentBalanceCreditsMilli > thresholdCreditsMilli) {
      continue;
    }

    if (
      (await hasActiveBillingAutoTopOffRun(target.organizationId)) ||
      (await hasQueuedOrRunningAutoTopOffJob(target.tenantId))
    ) {
      continue;
    }

    const latestRun = await findLatestBillingAutoTopOffRunByOrganizationId(
      target.organizationId,
    );

    if (
      latestRun?.status === AUTO_TOP_OFF_RUN_STATUSES.failed &&
      latestRun.completedAt &&
      latestRun.completedAt.getTime() >
        now - AUTO_TOP_OFF_FAILURE_COOLDOWN_MS
    ) {
      continue;
    }

    const monthlySpendCents = await getBillingAutoTopOffMonthlySpendCents({
      organizationId: target.organizationId,
    });

    if (
      monthlySpendCents + target.topOffAmountCents >
      target.monthlySpendLimitCents
    ) {
      continue;
    }

    await enqueueJob({
      jobType: JOB_TYPES.executeBillingAutoTopOff,
      payload: {
        organizationId: target.organizationId,
        tenantId: target.tenantId,
      },
    });
    queuedCount += 1;
  }

  return queuedCount;
}

export async function processExecuteBillingAutoTopOffJob(job: ClaimedJob) {
  if (job.jobType !== JOB_TYPES.executeBillingAutoTopOff) {
    throw new Error(
      `Unsupported job type for auto-top-off handler: ${job.jobType}`,
    );
  }

  const payload = parseExecuteBillingAutoTopOffPayload(job.payload);
  let runId: string | null = null;
  let stripeInvoiceId: string | null = null;

  try {
    const target = await getBillingAutoTopOffExecutionTargetByOrganizationId(
      payload.organizationId,
    );

    if (!target || target.tenantId !== payload.tenantId) {
      await appendJobEvent(
        job.id,
        AUTO_TOP_OFF_EVENTS.skipped,
        "Skipped auto-top-off because this workspace is no longer eligible.",
        {
          organizationId: payload.organizationId,
          tenantId: payload.tenantId,
        },
      );
      await markJobSucceeded(job.id, {
        skipped: true,
      });
      return;
    }

    const pack = getAutoTopOffPackByAmountCents(target.topOffAmountCents);

    if (!pack) {
      throw new Error(
        `Unsupported auto-top-off pack amount: ${target.topOffAmountCents}`,
      );
    }

    const thresholdCreditsMilli = target.minimumBalanceCredits * 1_000;

    if (target.currentBalanceCreditsMilli > thresholdCreditsMilli) {
      await appendJobEvent(
        job.id,
        AUTO_TOP_OFF_EVENTS.skipped,
        "Skipped auto-top-off because the workspace balance is above the minimum threshold again.",
        {
          currentBalanceCreditsMilli: target.currentBalanceCreditsMilli,
          minimumBalanceCredits: target.minimumBalanceCredits,
          organizationId: target.organizationId,
        },
      );
      await markJobSucceeded(job.id, {
        currentBalanceCreditsMilli: target.currentBalanceCreditsMilli,
        skipped: true,
      });
      return;
    }

    if (await hasActiveBillingAutoTopOffRun(target.organizationId)) {
      await appendJobEvent(
        job.id,
        AUTO_TOP_OFF_EVENTS.skipped,
        "Skipped auto-top-off because another top-up is already in flight for this workspace.",
        {
          organizationId: target.organizationId,
        },
      );
      await markJobSucceeded(job.id, {
        skipped: true,
      });
      return;
    }

    const monthlySpendCents = await getBillingAutoTopOffMonthlySpendCents({
      organizationId: target.organizationId,
    });

    if (
      monthlySpendCents + pack.amountCents >
      target.monthlySpendLimitCents
    ) {
      await appendJobEvent(
        job.id,
        AUTO_TOP_OFF_EVENTS.skipped,
        "Skipped auto-top-off because the monthly spend limit would be exceeded.",
        {
          monthlySpendCents,
          monthlySpendLimitCents: target.monthlySpendLimitCents,
          nextTopOffAmountCents: pack.amountCents,
          organizationId: target.organizationId,
        },
      );
      await markJobSucceeded(job.id, {
        monthlySpendCents,
        skipped: true,
      });
      return;
    }

    await appendJobEvent(
      job.id,
      AUTO_TOP_OFF_EVENTS.eligible,
      "Workspace is below the auto-top-off threshold. Starting a Stripe top-up charge.",
      {
        currentBalanceCreditsMilli: target.currentBalanceCreditsMilli,
        minimumBalanceCredits: target.minimumBalanceCredits,
        organizationId: target.organizationId,
        topOffAmountCents: pack.amountCents,
      },
    );

    const stripeIdempotencyKey = `auto-top-off:${randomUUID()}`;
    const run = await createBillingAutoTopOffRun({
      creditsGrantedMilli: pack.creditsGranted * 1_000,
      monthlySpendLimitCents: target.monthlySpendLimitCents,
      organizationId: target.organizationId,
      status: AUTO_TOP_OFF_RUN_STATUSES.processing,
      stripeCustomerId: target.stripeCustomerId,
      stripeIdempotencyKey,
      tenantId: target.tenantId,
      topOffAmountCents: pack.amountCents,
      triggerBalanceCreditsMilli: target.currentBalanceCreditsMilli,
    });

    if (!run) {
      throw new Error("Failed to create the auto-top-off run.");
    }

    runId = run.id;

    await appendJobEvent(
      job.id,
      AUTO_TOP_OFF_EVENTS.charging,
      "Creating and charging a Stripe invoice for the auto-top-off pack.",
      {
        autoTopOffRunId: run.id,
        lookupKey: pack.lookupKey,
      },
    );

    const stripe = getStripe();
    const stripePriceId = await getStripeOneTimePriceIdForTopUpLookupKey(
      pack.lookupKey,
    );
    const invoice = await stripe.invoices.create(
      {
        auto_advance: false,
        collection_method: "charge_automatically",
        customer: target.stripeCustomerId,
        description: `${pack.label} for auto-top-off`,
        metadata: {
          organization_id: target.organizationId,
          otto_charge_kind: "auto_top_off",
          otto_top_off_run_id: run.id,
          otto_top_up_lookup_key: pack.lookupKey,
          tenant_id: target.tenantId,
        },
      },
      {
        idempotencyKey: `${stripeIdempotencyKey}:invoice`,
      },
    );

    stripeInvoiceId = invoice.id;

    const invoiceItem = await stripe.invoiceItems.create(
      {
        customer: target.stripeCustomerId,
        description: `${pack.label} auto-top-off`,
        invoice: invoice.id,
        metadata: {
          organization_id: target.organizationId,
          otto_charge_kind: "auto_top_off",
          otto_top_off_run_id: run.id,
          otto_top_up_lookup_key: pack.lookupKey,
          tenant_id: target.tenantId,
        },
        pricing: {
          price: stripePriceId,
        },
        quantity: 1,
      },
      {
        idempotencyKey: `${stripeIdempotencyKey}:invoice-item`,
      },
    );

    await updateBillingAutoTopOffRunToAwaitingWebhook({
      runId: run.id,
      stripeInvoiceId: invoice.id,
      stripeInvoiceItemId: invoiceItem.id,
      stripePriceId,
      stripePriceLookupKey: pack.lookupKey,
    });

    await stripe.invoices.finalizeInvoice(invoice.id, undefined, {
      idempotencyKey: `${stripeIdempotencyKey}:finalize`,
    });

    const paidInvoice = await stripe.invoices.pay(
      invoice.id,
      {
        off_session: true,
      },
      {
        idempotencyKey: `${stripeIdempotencyKey}:pay`,
      },
    );

    if (paidInvoice.status !== "paid") {
      await markBillingAutoTopOffRunFailed({
        reason:
          paidInvoice.last_finalization_error?.message ??
          `Stripe invoice payment returned status ${paidInvoice.status ?? "unknown"}.`,
        runId: run.id,
        stripeInvoiceId: invoice.id,
      });
      await appendJobEvent(
        job.id,
        AUTO_TOP_OFF_EVENTS.failed,
        "Stripe could not complete the auto-top-off charge.",
        {
          autoTopOffRunId: run.id,
          invoiceStatus: paidInvoice.status,
          stripeInvoiceId: invoice.id,
        },
      );
      await markJobSucceeded(job.id, {
        autoTopOffRunId: run.id,
        skipped: false,
        status: paidInvoice.status,
      });
      return;
    }

    await appendJobEvent(
      job.id,
      AUTO_TOP_OFF_EVENTS.awaitingWebhook,
      "Stripe charged the top-up invoice. Waiting for the webhook to grant credits in Otto.",
      {
        autoTopOffRunId: run.id,
        stripeInvoiceId: invoice.id,
      },
    );

    await markJobSucceeded(job.id, {
      autoTopOffRunId: run.id,
      creditsGrantedMilli: pack.creditsGranted * 1_000,
      stripeInvoiceId: invoice.id,
      topOffAmountCents: pack.amountCents,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Auto-top-off execution failed.";

    if (runId) {
      await markBillingAutoTopOffRunFailed({
        reason: message,
        runId,
        stripeInvoiceId,
      });
    }

    await appendJobEvent(
      job.id,
      AUTO_TOP_OFF_EVENTS.failed,
      "Auto-top-off execution failed.",
      {
        error: message,
        stripeInvoiceId,
      },
    );
    await markJobFailed(job.id, message);
    throw error;
  }
}

async function hasQueuedOrRunningAutoTopOffJob(tenantId: string) {
  const db = getDb();
  const [job] = await db
    .select({
      id: jobRuns.id,
    })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.tenantId, tenantId),
        eq(jobRuns.jobType, JOB_TYPES.executeBillingAutoTopOff),
        inArray(jobRuns.status, [JOB_STATUSES.queued, JOB_STATUSES.running]),
      ),
    )
    .limit(1);

  return Boolean(job);
}

function parseExecuteBillingAutoTopOffPayload(
  payload: Record<string, unknown>,
): ExecuteBillingAutoTopOffPayload {
  const organizationId = payload.organizationId;
  const tenantId = payload.tenantId;

  if (typeof organizationId !== "string" || organizationId.length === 0) {
    throw new Error(
      "Execute auto-top-off job payload is missing organizationId",
    );
  }

  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Execute auto-top-off job payload is missing tenantId");
  }

  return {
    organizationId,
    tenantId,
  };
}

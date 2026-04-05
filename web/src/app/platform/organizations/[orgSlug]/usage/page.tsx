import { PlatformUsageContent } from "@/app/platform/organizations/[orgSlug]/_components/platform-usage-content";
import {
  formatTimestamp,
  getPlatformOrganizationDateTimePreferences,
  loadPlatformOrganizationDetailRouteContext,
} from "@/app/platform/organizations/[orgSlug]/_lib/platform-organization-detail";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getTenantCreditBalanceSummary } from "@/db/credit-ledger";
import { getTenantProviderUsageOverview } from "@/db/provider-usage";
import { formatCreditsFromMilli } from "@/lib/billing/openai-credit-pricing";

function formatUsageTypeLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatApiKeyLabel(value: string) {
  if (!value) {
    return "Not grouped";
  }

  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function formatSettlementStatusLabel(value: string | null) {
  switch (value) {
    case "priced":
      return "Priced";
    case "no_charge":
      return "No charge";
    case "unsupported":
      return "Not yet priced";
    default:
      return "Pending";
  }
}

export default async function PlatformOrganizationUsagePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization } =
    await loadPlatformOrganizationDetailRouteContext(orgSlug);
  const tenant = organization.tenant;

  if (!tenant) {
    return (
      <div className="px-4 pb-6 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No tenant provisioned yet</EmptyTitle>
            <EmptyDescription>
              This organization does not have a tenant runtime yet, so there is
              no provider usage to inspect.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (!tenant.openAiProvider?.projectId) {
    return (
      <div className="px-4 pb-6 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No OpenAI provider configured yet</EmptyTitle>
            <EmptyDescription>
              Provision an OpenAI project for this workspace first, then Otto
              can ingest and show raw provider usage here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const dateTimePreferences =
    getPlatformOrganizationDateTimePreferences(organization);
  const [usageOverview, creditBalance] = await Promise.all([
    getTenantProviderUsageOverview({
      tenantId: tenant.id,
    }),
    getTenantCreditBalanceSummary({
      tenantId: tenant.id,
    }),
  ]);
  const hourlyFormatter = new Intl.DateTimeFormat(organization.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: organization.timezone,
  });

  return (
    <PlatformUsageContent
      hourlyBuckets={usageOverview.hourlyBuckets.map((bucket) => ({
        creditsBurned: formatCreditsFromMilli(bucket.creditsBurnedMilli),
        hourLabel: hourlyFormatter.format(bucket.bucketHour),
        inputTokens: bucket.inputTokens,
        outputTokens: bucket.outputTokens,
        requestCount: bucket.requestCount,
      }))}
      lookbackLabel="24 hours"
      locale={organization.locale}
      recentBuckets={usageOverview.recentBuckets.map((bucket) => ({
        apiKeyLabel: formatApiKeyLabel(bucket.externalApiKeyId),
        bucketLabel: formatTimestamp(bucket.bucketStartAt, dateTimePreferences),
        creditsBurned: formatCreditsFromMilli(bucket.creditsBurnedMilli),
        inputTokens: bucket.inputTokens,
        itemCount: bucket.itemCount,
        modelLabel: bucket.model || "Not grouped",
        outputTokens: bucket.outputTokens,
        settlementStatusLabel: formatSettlementStatusLabel(
          bucket.settlementStatus,
        ),
        usageTypeLabel: formatUsageTypeLabel(bucket.usageType),
      }))}
      summary={{
        activeApiKeys: usageOverview.summary.activeApiKeys,
        activeModels: usageOverview.summary.activeModels,
        currentCreditBalance: formatCreditsFromMilli(
          creditBalance.currentBalanceCreditsMilli,
        ),
        latestBucketLabel: usageOverview.summary.latestBucketEndAt
          ? formatTimestamp(
              usageOverview.summary.latestBucketEndAt,
              dateTimePreferences,
            )
          : null,
        totalCreditsDebited: formatCreditsFromMilli(
          creditBalance.totalDebitedCreditsMilli,
        ),
        totalCreditsBurned: formatCreditsFromMilli(
          usageOverview.summary.totalCreditsBurnedMilli,
        ),
        totalCreditsGranted: formatCreditsFromMilli(
          creditBalance.totalGrantedCreditsMilli,
        ),
        totalInputTokens: usageOverview.summary.totalInputTokens,
        totalOutputTokens: usageOverview.summary.totalOutputTokens,
        totalRequests: usageOverview.summary.totalRequests,
      }}
      syncStates={usageOverview.syncStates.map((state) => ({
        consecutiveFailures: state.consecutiveFailures,
        lastAttemptedLabel: state.lastAttemptedAt
          ? formatTimestamp(state.lastAttemptedAt, dateTimePreferences)
          : "Not attempted",
        lastError: state.lastError,
        lastRowCount: state.lastRowCount,
        lastSuccessfulLabel: state.lastSuccessfulEndAt
          ? formatTimestamp(state.lastSuccessfulEndAt, dateTimePreferences)
          : "No success yet",
        status:
          state.lastError && state.consecutiveFailures > 0
            ? "attention"
            : state.lastSuccessfulEndAt
              ? "healthy"
              : "pending",
        usageTypeLabel: formatUsageTypeLabel(state.usageType),
      }))}
      usageByModel={usageOverview.usageByModel.map((row) => ({
        creditsBurned: formatCreditsFromMilli(row.creditsBurnedMilli),
        inputTokens: row.inputTokens,
        model: row.model,
        outputTokens: row.outputTokens,
        requestCount: row.requestCount,
        totalTokens: row.totalTokens,
        usageTypeLabel: formatUsageTypeLabel(row.usageType),
      }))}
      usageByType={usageOverview.usageByType.map((row) => ({
        creditsBurned: formatCreditsFromMilli(row.creditsBurnedMilli),
        requestCount: row.requestCount,
        totalTokens: row.totalTokens,
        usageTypeLabel: formatUsageTypeLabel(row.usageType),
      }))}
    />
  );
}

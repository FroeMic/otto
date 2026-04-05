import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { SettingsPage } from "@/app/[orgSlug]/settings/_components/settings-layout";
import { WorkspaceUsageContent } from "@/app/[orgSlug]/settings/workspace/usage/_components/workspace-usage-content";
import { getWorkspaceBillingOverview } from "@/db/billing";
import { getTenantProviderUsageOverview } from "@/db/provider-usage";

export const dynamic = "force-dynamic";

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

export default async function WorkspaceUsagePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization } = await loadOrganizationRouteContext(orgSlug);
  const billingOverview = await getWorkspaceBillingOverview({
    organizationId: currentOrganization.id,
  });
  const now = new Date();
  const sub = billingOverview.subscription;
  const currentCycleStart = sub?.currentPeriodStart ?? startOfMonth(now);
  const currentCycleEnd = sub?.currentPeriodEnd ?? null;

  // Compute previous billing cycle if subscription exists
  let previousCycleStart: Date | null = null;
  let previousCycleEnd: Date | null = null;
  if (sub?.currentPeriodStart && sub?.currentPeriodEnd) {
    const cycleDurationMs =
      sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime();
    previousCycleEnd = new Date(sub.currentPeriodStart.getTime());
    previousCycleStart = new Date(
      sub.currentPeriodStart.getTime() - cycleDurationMs,
    );
  }

  const initialRangeTo = currentCycleEnd ?? now;
  const initialOverview = billingOverview.tenant
    ? await getTenantProviderUsageOverview({
        from: currentCycleStart,
        tenantId: billingOverview.tenant.id,
        to: initialRangeTo,
      })
    : {
        summary: {
          activeApiKeys: 0,
          activeModels: 0,
          totalCreditsBurnedMilli: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalProviderCostMicros: 0,
          totalRequests: 0,
        },
        timeSeries: [],
        usageByModel: [],
        usageByType: [],
      };

  return (
    <SettingsPage>
      <WorkspaceUsageContent
        autoReloadEnabled={billingOverview.preferences.autoTopOffEnabled}
        currentBalanceCreditsMilli={
          billingOverview.balance.currentBalanceCreditsMilli
        }
        currentCycleEndIso={currentCycleEnd?.toISOString() ?? null}
        currentCycleStartIso={currentCycleStart.toISOString()}
        initialOverview={initialOverview}
        initialRange={{
          from: currentCycleStart.toISOString(),
          to: initialRangeTo.toISOString(),
        }}
        locale={currentOrganization.locale}
        orgSlug={orgSlug}
        previousCycleEndIso={previousCycleEnd?.toISOString() ?? null}
        previousCycleStartIso={previousCycleStart?.toISOString() ?? null}
      />
    </SettingsPage>
  );
}

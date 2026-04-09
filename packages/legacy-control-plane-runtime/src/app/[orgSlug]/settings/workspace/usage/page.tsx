import { loadOrganizationRouteContext } from "../../../_lib/organization-context";
import { SettingsPage } from "../../_components/settings-layout";
import { WorkspaceUsageContent } from "./_components/workspace-usage-content";
import { getWorkspaceBillingOverview } from "../../../../../db/billing";
import { getTenantProviderUsageOverview } from "../../../../../db/provider-usage";
import {
  endOfUtcMonth,
  getPreviousBillingCycleRange,
  startOfUtcMonth,
} from "../../../../../lib/usage-date-ranges";

export const dynamic = "force-dynamic";

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
  const currentCycleStart = sub?.currentPeriodStart ?? startOfUtcMonth(now);
  const currentCycleEnd = sub?.currentPeriodEnd ?? endOfUtcMonth(now);
  const previousCycleRange = getPreviousBillingCycleRange({
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    currentPeriodStart: sub?.currentPeriodStart ?? null,
  });
  const initialOverview = billingOverview.tenant
    ? await getTenantProviderUsageOverview({
        from: currentCycleStart,
        tenantId: billingOverview.tenant.id,
        to: currentCycleEnd,
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
          to: currentCycleEnd.toISOString(),
        }}
        locale={currentOrganization.locale}
        orgSlug={orgSlug}
        previousCycleEndIso={previousCycleRange?.to.toISOString() ?? null}
        previousCycleStartIso={previousCycleRange?.from.toISOString() ?? null}
      />
    </SettingsPage>
  );
}

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
  const currentCycleStart =
    billingOverview.subscription?.currentPeriodStart ?? startOfMonth(now);
  const initialOverview = billingOverview.tenant
    ? await getTenantProviderUsageOverview({
        from: currentCycleStart,
        tenantId: billingOverview.tenant.id,
        to: now,
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
        currentCycleStartIso={currentCycleStart.toISOString()}
        initialOverview={initialOverview}
        initialRange={{
          from: currentCycleStart.toISOString(),
          to: now.toISOString(),
        }}
        locale={currentOrganization.locale}
        orgSlug={orgSlug}
      />
    </SettingsPage>
  );
}

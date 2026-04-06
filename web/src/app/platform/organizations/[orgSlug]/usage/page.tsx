import { PlatformUsageContent } from "@/app/platform/organizations/[orgSlug]/_components/platform-usage-content";
import { loadPlatformOrganizationDetailRouteContext } from "@/app/platform/organizations/[orgSlug]/_lib/platform-organization-detail";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getWorkspaceBillingOverview } from "@/db/billing";
import { getTenantCreditBalanceSummary } from "@/db/credit-ledger";
import { formatCreditsFromMilli } from "@/lib/billing/openai-credit-pricing";
import { getPreviousBillingCycleRange } from "@/lib/usage-date-ranges";

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
              Provision an OpenAI project for this workspace first, then usage
              data will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const creditBalance = await getTenantCreditBalanceSummary({
    tenantId: tenant.id,
  });
  const billingOverview = await getWorkspaceBillingOverview({
    organizationId: organization.id,
  });
  const previousCycleRange = getPreviousBillingCycleRange({
    currentPeriodEnd: billingOverview.subscription?.currentPeriodEnd ?? null,
    currentPeriodStart:
      billingOverview.subscription?.currentPeriodStart ?? null,
  });

  return (
    <PlatformUsageContent
      creditBalance={{
        currentBalance: formatCreditsFromMilli(
          creditBalance.currentBalanceCreditsMilli,
        ),
        totalDebited: formatCreditsFromMilli(
          creditBalance.totalDebitedCreditsMilli,
        ),
        totalGranted: formatCreditsFromMilli(
          creditBalance.totalGrantedCreditsMilli,
        ),
      }}
      currentCycleEndIso={
        billingOverview.subscription?.currentPeriodEnd?.toISOString() ?? null
      }
      currentCycleStartIso={
        billingOverview.subscription?.currentPeriodStart?.toISOString() ?? null
      }
      locale={organization.locale}
      orgSlug={orgSlug}
      previousCycleEndIso={previousCycleRange?.to.toISOString() ?? null}
      previousCycleStartIso={previousCycleRange?.from.toISOString() ?? null}
      timezone={organization.timezone}
    />
  );
}

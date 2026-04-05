import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  SettingsCard,
  SettingsPage,
  SettingsPageTitle,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { WorkspaceBillingActions } from "@/app/[orgSlug]/settings/workspace/billing/_components/workspace-billing-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceBillingOverview } from "@/db/billing";
import { getTenantProviderUsageOverview } from "@/db/provider-usage";
import { formatCreditsFromMilli } from "@/lib/billing/openai-credit-pricing";
import { getBillingPlans } from "@/lib/billing/plans";
import { formatShortDate, formatShortDateTime } from "@/lib/date-time";
import { hasStripeBillingConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
    minimumFractionDigits: value > 0 && value < 1 ? 3 : 0,
  }).format(value);
}

export default async function WorkspaceBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { orgSlug } = await params;
  const { checkout } = await searchParams;
  const { currentOrganization } = await loadOrganizationRouteContext(orgSlug);
  const billingOverview = await getWorkspaceBillingOverview({
    organizationId: currentOrganization.id,
  });
  const usageOverview = billingOverview.tenant
    ? await getTenantProviderUsageOverview({
        tenantId: billingOverview.tenant.id,
      })
    : null;
  const billingConfigured = hasStripeBillingConfig();
  const plans = billingConfigured ? getBillingPlans() : [];
  const currentPlan = billingOverview.subscription?.planKey
    ? (plans.find(
        (plan) => plan.key === billingOverview.subscription?.planKey,
      ) ?? null)
    : null;
  const dateTimeInput = {
    locale: currentOrganization.locale,
    timeFormatPreference: currentOrganization.timeFormatPreference,
    timeZone: currentOrganization.timezone,
  };

  return (
    <SettingsPage>
      <div className="flex flex-col gap-8">
        <SettingsPageTitle>Billing</SettingsPageTitle>

        {checkout === "success" ? (
          <Alert>
            <AlertTitle>Checkout completed</AlertTitle>
            <AlertDescription>
              Stripe completed the hosted checkout flow. Credits are granted
              only after the related invoice is paid and the webhook is
              processed.
            </AlertDescription>
          </Alert>
        ) : null}

        {checkout === "canceled" ? (
          <Alert>
            <AlertTitle>Checkout canceled</AlertTitle>
            <AlertDescription>
              No billing changes were made. You can start checkout again from
              this page at any time.
            </AlertDescription>
          </Alert>
        ) : null}

        {!billingConfigured ? (
          <Alert variant="destructive">
            <AlertTitle>Stripe billing is not configured</AlertTitle>
            <AlertDescription>
              Set the Stripe secret key, webhook secret, and monthly price IDs
              before enabling paid plans for this workspace.
            </AlertDescription>
          </Alert>
        ) : null}

        <SettingsSection>
          <SettingsSectionTitle>Current plan</SettingsSectionTitle>
          <SettingsSectionDescription>
            Manage the paid plan and the spendable credit balance for this
            workspace.
          </SettingsSectionDescription>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Plan</SettingsRowTitle>
                <SettingsRowDescription>
                  {billingOverview.subscription
                    ? "Current Stripe-backed subscription mirrored into Otto."
                    : "No active paid plan is connected to this workspace yet."}
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="flex items-center gap-2">
                {billingOverview.subscription ? (
                  <>
                    <Badge variant="secondary">
                      {currentPlan?.name ??
                        billingOverview.subscription.planKey}
                    </Badge>
                    <Badge variant="outline">
                      {billingOverview.subscription.status}
                    </Badge>
                  </>
                ) : (
                  <Badge variant="outline">No subscription</Badge>
                )}
              </div>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Current balance</SettingsRowTitle>
                <SettingsRowDescription>
                  The proxy and usage settlement pipeline both read from Otto’s
                  internal ledger balance.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="text-right">
                <div className="text-sm font-medium">
                  {formatNumber(
                    formatCreditsFromMilli(
                      billingOverview.balance.currentBalanceCreditsMilli,
                    ),
                    currentOrganization.locale,
                  )}{" "}
                  credits
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatNumber(
                    formatCreditsFromMilli(
                      billingOverview.balance.totalGrantedCreditsMilli,
                    ),
                    currentOrganization.locale,
                  )}{" "}
                  granted ·{" "}
                  {formatNumber(
                    formatCreditsFromMilli(
                      billingOverview.balance.totalDebitedCreditsMilli,
                    ),
                    currentOrganization.locale,
                  )}{" "}
                  burned
                </div>
              </div>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Renewal</SettingsRowTitle>
                <SettingsRowDescription>
                  Otto grants included monthly credits from paid invoices and
                  expires them at the end of the billing period.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="text-right text-sm">
                {billingOverview.subscription?.currentPeriodEnd
                  ? formatShortDate(
                      billingOverview.subscription.currentPeriodEnd,
                      dateTimeInput,
                    )
                  : "Not scheduled"}
              </div>
            </SettingsRow>
            <SettingsRow className="items-start">
              <SettingsRowLabel>
                <SettingsRowTitle>Billing actions</SettingsRowTitle>
                <SettingsRowDescription>
                  Hosted checkout is used for starting a plan. The Stripe portal
                  handles payment methods, invoices, cancellation, and plan
                  changes.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <WorkspaceBillingActions
                canManageBilling={billingConfigured}
                canOpenBillingPortal={Boolean(billingOverview.customer)}
                currentPlanKey={billingOverview.subscription?.planKey ?? null}
                orgSlug={orgSlug}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Plans</SettingsSectionTitle>
          <SettingsCard>
            {plans.map((plan) => (
              <SettingsRow key={plan.key}>
                <SettingsRowLabel>
                  <SettingsRowTitle>{plan.name}</SettingsRowTitle>
                  <SettingsRowDescription>
                    {new Intl.NumberFormat(currentOrganization.locale).format(
                      plan.creditsIncluded,
                    )}{" "}
                    credits included each month.
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <div className="text-right text-sm font-medium">
                  ${plan.monthlyPriceUsd}/month
                </div>
              </SettingsRow>
            ))}
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Recent grants</SettingsSectionTitle>
          <SettingsCard>
            {billingOverview.recentGrants.length > 0 ? (
              billingOverview.recentGrants.map((grant) => (
                <SettingsRow key={grant.id}>
                  <SettingsRowLabel>
                    <SettingsRowTitle>
                      {grant.planKey ?? grant.sourceType}
                    </SettingsRowTitle>
                    <SettingsRowDescription>
                      Granted{" "}
                      {formatShortDateTime(grant.grantedAt, dateTimeInput)}
                      {grant.expiresAt
                        ? ` · Expires ${formatShortDate(grant.expiresAt, dateTimeInput)}`
                        : ""}
                    </SettingsRowDescription>
                  </SettingsRowLabel>
                  <div className="text-right text-sm font-medium">
                    +
                    {formatNumber(
                      formatCreditsFromMilli(grant.creditsGrantedMilli),
                      currentOrganization.locale,
                    )}{" "}
                    credits
                  </div>
                </SettingsRow>
              ))
            ) : (
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>No grants yet</SettingsRowTitle>
                  <SettingsRowDescription>
                    Subscription and top-up grants will appear here after Stripe
                    payments are processed.
                  </SettingsRowDescription>
                </SettingsRowLabel>
              </SettingsRow>
            )}
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Recent activity</SettingsSectionTitle>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>24-hour usage</SettingsRowTitle>
                <SettingsRowDescription>
                  Recent raw usage and credit burn continue to live on the
                  platform usage view internally; this workspace page exposes a
                  concise summary first.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="text-right text-sm">
                {usageOverview ? (
                  <>
                    <div>
                      {new Intl.NumberFormat(currentOrganization.locale).format(
                        usageOverview.summary.totalRequests,
                      )}{" "}
                      requests
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(
                        formatCreditsFromMilli(
                          usageOverview.summary.totalCreditsBurnedMilli,
                        ),
                        currentOrganization.locale,
                      )}{" "}
                      credits burned
                    </div>
                  </>
                ) : (
                  "No tenant usage yet"
                )}
              </div>
            </SettingsRow>
            {billingOverview.recentLedgerEntries.length > 0
              ? billingOverview.recentLedgerEntries.map((entry) => (
                  <SettingsRow key={entry.id}>
                    <SettingsRowLabel>
                      <SettingsRowTitle>{entry.entryType}</SettingsRowTitle>
                      <SettingsRowDescription>
                        {entry.description ?? "Credit ledger entry"} ·{" "}
                        {formatShortDateTime(entry.createdAt, dateTimeInput)}
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <div className="text-right text-sm font-medium">
                      {entry.creditsDeltaMilli >= 0 ? "+" : ""}
                      {formatNumber(
                        formatCreditsFromMilli(entry.creditsDeltaMilli),
                        currentOrganization.locale,
                      )}{" "}
                      credits
                    </div>
                  </SettingsRow>
                ))
              : null}
          </SettingsCard>
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}

import Link from "next/link";

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
import {
  WorkspaceCheckoutButton,
  WorkspaceManageBillingButton,
} from "@/app/[orgSlug]/settings/workspace/billing/_components/workspace-billing-actions";
import { WorkspaceBillingPreferencesCard } from "@/app/[orgSlug]/settings/workspace/billing/_components/workspace-billing-preferences-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWorkspaceBillingOverview } from "@/db/billing";
import { getBillingPlans } from "@/lib/billing/plans";
import { listStripeInvoicesForCustomer } from "@/lib/billing/stripe";
import { formatShortDate } from "@/lib/date-time";
import { hasStripeBillingConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

function formatCredits(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatPrice(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatPriceFromCents(
  amountCents: number,
  currency: string,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amountCents / 100);
}

function getInvoiceBadgeVariant(status: string | null) {
  if (status === "paid") {
    return "secondary";
  }

  if (status === "uncollectible" || status === "void") {
    return "destructive";
  }

  return "outline";
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
  const billingConfigured = hasStripeBillingConfig();
  const plans = billingConfigured ? getBillingPlans() : [];
  const currentPlan = billingOverview.subscription?.planKey
    ? (plans.find(
        (plan) => plan.key === billingOverview.subscription?.planKey,
      ) ?? null)
    : null;
  const currentPlanIndex = currentPlan
    ? plans.findIndex((plan) => plan.key === currentPlan.key)
    : -1;
  const suggestedPlan =
    currentPlanIndex >= 0 && currentPlanIndex < plans.length - 1
      ? (plans[currentPlanIndex + 1] ?? null)
      : currentPlan
        ? null
        : (plans[0] ?? null);
  const dateTimeInput = {
    locale: currentOrganization.locale,
    timeFormatPreference: currentOrganization.timeFormatPreference,
    timeZone: currentOrganization.timezone,
  };
  let invoices: Awaited<ReturnType<typeof listStripeInvoicesForCustomer>> = [];
  let invoicesError: string | null = null;

  if (billingConfigured && billingOverview.customer) {
    try {
      invoices = await listStripeInvoicesForCustomer({
        stripeCustomerId: billingOverview.customer.stripeCustomerId,
      });
    } catch (error) {
      invoicesError =
        error instanceof Error
          ? error.message
          : "Invoice history is temporarily unavailable.";
    }
  }

  return (
    <SettingsPage>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <SettingsPageTitle>Billing</SettingsPageTitle>
            <p className="text-sm text-muted-foreground">
              Manage your plan, billing settings, and upcoming invoices for this
              workspace.
            </p>
          </div>
          <Button
            render={
              <Link href={`/${orgSlug}/settings/workspace/billing/plans`} />
            }
            variant="outline"
          >
            All plans
          </Button>
        </div>

        {checkout === "success" ? (
          <Alert className="rounded-lg">
            <AlertTitle>Subscription started</AlertTitle>
            <AlertDescription>
              Your checkout is complete. Your plan and credit balance will
              update as soon as payment is confirmed.
            </AlertDescription>
          </Alert>
        ) : null}

        {checkout === "canceled" ? (
          <Alert className="rounded-lg">
            <AlertTitle>Checkout canceled</AlertTitle>
            <AlertDescription>
              No billing changes were made. You can start checkout again from
              this page at any time.
            </AlertDescription>
          </Alert>
        ) : null}

        {!billingConfigured ? (
          <Alert className="rounded-lg" variant="destructive">
            <AlertTitle>Stripe billing is not configured</AlertTitle>
            <AlertDescription>
              Set the Stripe secret key and webhook secret, then configure the
              recurring plan prices in Stripe with the expected lookup keys
              before enabling paid plans for this workspace.
            </AlertDescription>
          </Alert>
        ) : null}

        <SettingsSection>
          <SettingsSectionTitle>Current subscription</SettingsSectionTitle>
          <SettingsSectionDescription>
            View your current plan, renewal date, and the actions available for
            subscription management.
          </SettingsSectionDescription>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>
                  {currentPlan ? `${currentPlan.name} plan` : "No active plan"}
                </SettingsRowTitle>
                <SettingsRowDescription>
                  {currentPlan
                    ? `${formatPrice(currentPlan.monthlyPriceUsd, currentOrganization.locale)}/month · ${formatCredits(currentPlan.creditsIncluded, currentOrganization.locale)} credits included each month`
                    : "Choose a paid plan to start getting included monthly credits."}
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="flex items-center gap-2">
                {currentPlan ? (
                  <>
                    <Badge variant="secondary">Current</Badge>
                    {billingOverview.subscription ? (
                      <Badge variant="outline">
                        {billingOverview.subscription.status}
                      </Badge>
                    ) : null}
                  </>
                ) : (
                  <Badge variant="outline">No subscription</Badge>
                )}
              </div>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Renewal</SettingsRowTitle>
                <SettingsRowDescription>
                  Plan changes remain managed in Stripe for now.
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
                <SettingsRowTitle>Actions</SettingsRowTitle>
                <SettingsRowDescription>
                  Use Stripe to update payment details, switch plans, or cancel
                  once a subscription is active.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="flex flex-wrap gap-2">
                <WorkspaceManageBillingButton
                  canOpenBillingPortal={Boolean(billingOverview.customer)}
                  orgSlug={orgSlug}
                />
                {!currentPlan && billingConfigured && plans[0] ? (
                  <WorkspaceCheckoutButton
                    canManageBilling={billingConfigured}
                    label={`Start ${plans[0].name}`}
                    orgSlug={orgSlug}
                    planKey={plans[0].key}
                  />
                ) : null}
              </div>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Change plan</SettingsSectionTitle>
          <SettingsSectionDescription>
            Compare plans in Otto, then use Stripe to apply the change for this
            workspace.
          </SettingsSectionDescription>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>
                  {suggestedPlan
                    ? currentPlan
                      ? `Move to ${suggestedPlan.name}`
                      : "Choose your first plan"
                    : "You are already on the highest plan"}
                </SettingsRowTitle>
                <SettingsRowDescription>
                  {suggestedPlan
                    ? `${formatPrice(suggestedPlan.monthlyPriceUsd, currentOrganization.locale)}/month · ${formatCredits(suggestedPlan.creditsIncluded, currentOrganization.locale)} credits each month`
                    : "Compare plans to review the full catalog and manage future changes in Stripe."}
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="flex flex-wrap gap-2">
                <Button
                  render={
                    <Link
                      href={`/${orgSlug}/settings/workspace/billing/plans`}
                    />
                  }
                  variant="outline"
                >
                  View all plans
                </Button>
                {currentPlan ? (
                  <WorkspaceManageBillingButton
                    canOpenBillingPortal={Boolean(billingOverview.customer)}
                    label="Change in billing"
                    orgSlug={orgSlug}
                  />
                ) : suggestedPlan ? (
                  <WorkspaceCheckoutButton
                    canManageBilling={billingConfigured}
                    label={`Choose ${suggestedPlan.name}`}
                    orgSlug={orgSlug}
                    planKey={suggestedPlan.key}
                  />
                ) : null}
              </div>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Auto-reload credits</SettingsSectionTitle>
          <SettingsSectionDescription>
            Automatically add credits when your balance drops below a minimum
            threshold.
          </SettingsSectionDescription>
          <SettingsCard>
            <WorkspaceBillingPreferencesCard
              initialPreferences={billingOverview.preferences}
              locale={currentOrganization.locale}
              orgSlug={orgSlug}
            />
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Invoices</SettingsSectionTitle>
          <SettingsSectionDescription>
            Review recent subscription invoices and open the Stripe-hosted
            invoice pages when they are available.
          </SettingsSectionDescription>
          <SettingsCard>
            {invoicesError ? (
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>
                    Invoice history unavailable
                  </SettingsRowTitle>
                  <SettingsRowDescription>
                    {invoicesError}
                  </SettingsRowDescription>
                </SettingsRowLabel>
              </SettingsRow>
            ) : invoices.length > 0 ? (
              invoices.map((invoice) => (
                <SettingsRow key={invoice.id}>
                  <SettingsRowLabel>
                    <SettingsRowTitle>
                      {invoice.number ?? "Stripe invoice"}
                    </SettingsRowTitle>
                    <SettingsRowDescription>
                      {formatShortDate(invoice.createdAt, dateTimeInput)} ·{" "}
                      {formatPriceFromCents(
                        invoice.amountPaidCents > 0
                          ? invoice.amountPaidCents
                          : invoice.amountDueCents,
                        invoice.currency,
                        currentOrganization.locale,
                      )}
                    </SettingsRowDescription>
                  </SettingsRowLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getInvoiceBadgeVariant(invoice.status)}>
                      {invoice.status ?? "open"}
                    </Badge>
                    {invoice.hostedInvoiceUrl ? (
                      <Button
                        render={
                          <a
                            aria-label={`View ${invoice.number ?? "invoice"} in Stripe`}
                            href={invoice.hostedInvoiceUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            View
                          </a>
                        }
                        size="sm"
                        variant="outline"
                      />
                    ) : null}
                    {invoice.invoicePdfUrl ? (
                      <Button
                        render={
                          <a
                            aria-label={`Download PDF for ${invoice.number ?? "invoice"}`}
                            href={invoice.invoicePdfUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            PDF
                          </a>
                        }
                        size="sm"
                        variant="outline"
                      />
                    ) : null}
                  </div>
                </SettingsRow>
              ))
            ) : (
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>No invoices yet</SettingsRowTitle>
                  <SettingsRowDescription>
                    Your invoice history will appear here after the first
                    successful Stripe payment.
                  </SettingsRowDescription>
                </SettingsRowLabel>
              </SettingsRow>
            )}
          </SettingsCard>
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}

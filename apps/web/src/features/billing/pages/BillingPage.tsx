import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useSearch } from "@tanstack/react-router"
import {
  SettingsCard,
  SettingsPage,
  SettingsPageContent,
  SettingsPageTitle,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"
import { formatShortDate } from "@/features/workspace/date-time"

import { billingOverviewQueryOptions } from "../api/billing"
import {
  WorkspaceCheckoutButton,
  WorkspaceManageBillingButton,
} from "../components/BillingActions"
import {
  WorkspaceBillingPreferencesCard,
  WorkspaceSpendLimitCard,
} from "../components/BillingPreferencesCards"

export interface BillingPageProps {
  orgSlug: string
}

function formatCredits(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value)
}

function formatPrice(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value)
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
  }).format(amountCents / 100)
}

function getInvoiceBadgeVariant(status: string | null) {
  if (status === "paid") return "secondary" as const
  if (status === "uncollectible" || status === "void") {
    return "destructive" as const
  }

  return "outline" as const
}

function getAutoTopOffBadgeVariant(status: string) {
  if (status === "succeeded") return "secondary" as const
  if (status === "failed") return "destructive" as const

  return "outline" as const
}

export function BillingPage({ orgSlug }: BillingPageProps) {
  const { data: shellData } = useSuspenseQuery(
    shellBootstrapQueryOptions(orgSlug),
  )
  const { data: billingOverview } = useSuspenseQuery(
    billingOverviewQueryOptions(orgSlug),
  )
  const search = useSearch({ from: "/$orgSlug/settings/workspace/billing" })
  const currentPlan = billingOverview.subscription?.planKey
    ? (billingOverview.plans.find(
        (plan) => plan.key === billingOverview.subscription?.planKey,
      ) ?? null)
    : null
  const currentCycleSpendCents = billingOverview.currentCycleSpendCents
  const wouldBlockNextAutoReload =
    billingOverview.preferences.autoTopOffEnabled &&
    billingOverview.preferences.monthlySpendLimitCents > 0 &&
    billingOverview.nextAutoReloadChargeCents !== null &&
    currentCycleSpendCents + billingOverview.nextAutoReloadChargeCents >
      billingOverview.preferences.monthlySpendLimitCents

  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <SettingsPageTitle>Billing</SettingsPageTitle>
          <Button
            render={
              <Link
                params={{ orgSlug }}
                to="/$orgSlug/settings/workspace/billing/plans"
              />
            }
            variant="outline"
          >
            All plans
          </Button>
        </div>

        {search.checkout === "success" ? (
          <Alert className="rounded-lg">
            <AlertTitle>Subscription started</AlertTitle>
            <AlertDescription>
              Your checkout is complete. Your plan and credit balance will
              update as soon as payment is confirmed.
            </AlertDescription>
          </Alert>
        ) : null}

        {search.checkout === "canceled" ? (
          <Alert className="rounded-lg">
            <AlertTitle>Checkout canceled</AlertTitle>
            <AlertDescription>
              No billing changes were made. You can start checkout again from
              this page at any time.
            </AlertDescription>
          </Alert>
        ) : null}

        {!billingOverview.billingConfigured ? (
          <Alert className="rounded-lg" variant="destructive">
            <AlertTitle>Stripe billing is not configured</AlertTitle>
            <AlertDescription>
              Configure Stripe before enabling paid plans for this workspace.
            </AlertDescription>
          </Alert>
        ) : null}

        <SettingsSection>
          <SettingsSectionTitle>Current subscription</SettingsSectionTitle>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>
                  {currentPlan ? `${currentPlan.name} plan` : "No active plan"}
                </SettingsRowTitle>
                <SettingsRowDescription>
                  {currentPlan
                    ? `${formatPrice(currentPlan.monthlyPriceUsd, shellData.currentOrganization.locale)}/month · ${formatCredits(currentPlan.creditsIncluded, shellData.currentOrganization.locale)} credits included`
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
              </SettingsRowLabel>
              <div className="text-right text-sm">
                {billingOverview.subscription?.currentPeriodEnd
                  ? formatShortDate(
                      new Date(billingOverview.subscription.currentPeriodEnd),
                      {
                        locale: shellData.currentOrganization.locale,
                        timeFormatPreference:
                          shellData.currentOrganization.timeFormatPreference,
                        timeZone: shellData.currentOrganization.timezone,
                      },
                    )
                  : "Not scheduled"}
              </div>
            </SettingsRow>
            <SettingsRow className="items-start">
              <SettingsRowLabel>
                <SettingsRowTitle>Manage billing details</SettingsRowTitle>
                <SettingsRowDescription>
                  Update payment methods, view invoices, or manage your
                  subscription in the billing portal.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <WorkspaceManageBillingButton
                canOpenBillingPortal={Boolean(billingOverview.customer)}
                orgSlug={orgSlug}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Manage plan</SettingsSectionTitle>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Compare plans</SettingsRowTitle>
                <SettingsRowDescription>
                  See what each plan includes and find the right fit.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <Button
                render={
                  <Link
                    params={{ orgSlug }}
                    to="/$orgSlug/settings/workspace/billing/plans"
                  />
                }
                variant="outline"
              >
                View all plans
              </Button>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Change plan</SettingsRowTitle>
                <SettingsRowDescription>
                  Switch to a different plan through the billing portal.
                </SettingsRowDescription>
              </SettingsRowLabel>
              {currentPlan ? (
                <WorkspaceManageBillingButton
                  canOpenBillingPortal={Boolean(billingOverview.customer)}
                  label="Change plan"
                  orgSlug={orgSlug}
                />
              ) : billingOverview.billingConfigured &&
                billingOverview.plans[0] ? (
                <WorkspaceCheckoutButton
                  canManageBilling={billingOverview.billingConfigured}
                  label={`Start ${billingOverview.plans[0].name}`}
                  orgSlug={orgSlug}
                  planKey={billingOverview.plans[0].key}
                />
              ) : null}
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Cancel subscription</SettingsRowTitle>
                <SettingsRowDescription>
                  Cancel your current plan through the billing portal.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <WorkspaceManageBillingButton
                canOpenBillingPortal={Boolean(billingOverview.customer)}
                label="Manage subscription"
                orgSlug={orgSlug}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Auto-reload credits</SettingsSectionTitle>
          <SettingsCard>
            <WorkspaceBillingPreferencesCard
              initialPreferences={billingOverview.preferences}
              latestRunFailureReason={
                billingOverview.autoTopOff.latestRun?.failureReason ?? null
              }
              latestRunStatus={
                billingOverview.autoTopOff.latestRun?.status ?? null
              }
              locale={shellData.currentOrganization.locale}
              orgSlug={orgSlug}
            />
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Spend limit</SettingsSectionTitle>
          <SettingsCard>
            <WorkspaceSpendLimitCard
              currentCycleSpendCents={currentCycleSpendCents}
              initialPreferences={billingOverview.preferences}
              locale={shellData.currentOrganization.locale}
              nextAutoReloadChargeCents={
                billingOverview.nextAutoReloadChargeCents
              }
              orgSlug={orgSlug}
              wouldBlockNextAutoReload={wouldBlockNextAutoReload}
            />
            {billingOverview.autoTopOff.latestRun ? (
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>
                    Latest auto-reload attempt
                  </SettingsRowTitle>
                  <SettingsRowDescription>
                    {formatShortDate(
                      new Date(
                        billingOverview.autoTopOff.latestRun.completedAt ??
                          billingOverview.autoTopOff.latestRun.createdAt,
                      ),
                      {
                        locale: shellData.currentOrganization.locale,
                        timeFormatPreference:
                          shellData.currentOrganization.timeFormatPreference,
                        timeZone: shellData.currentOrganization.timezone,
                      },
                    )}
                    {" · "}
                    {formatPriceFromCents(
                      billingOverview.autoTopOff.latestRun.topOffAmountCents,
                      "usd",
                      shellData.currentOrganization.locale,
                    )}
                    {billingOverview.autoTopOff.latestRun.failureReason
                      ? ` · ${billingOverview.autoTopOff.latestRun.failureReason}`
                      : ""}
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <Badge
                  variant={getAutoTopOffBadgeVariant(
                    billingOverview.autoTopOff.latestRun.status,
                  )}
                >
                  {billingOverview.autoTopOff.latestRun.status}
                </Badge>
              </SettingsRow>
            ) : null}
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Invoices</SettingsSectionTitle>
          <SettingsCard>
            {billingOverview.invoicesError ? (
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>
                    Invoice history unavailable
                  </SettingsRowTitle>
                  <SettingsRowDescription>
                    {billingOverview.invoicesError}
                  </SettingsRowDescription>
                </SettingsRowLabel>
              </SettingsRow>
            ) : billingOverview.invoices.length > 0 ? (
              billingOverview.invoices.map((invoice) => (
                <SettingsRow key={invoice.id}>
                  <SettingsRowLabel>
                    <SettingsRowTitle>
                      {invoice.number ?? "Stripe invoice"}
                      {invoice.status ? (
                        <Badge
                          className="ml-2"
                          variant={getInvoiceBadgeVariant(invoice.status)}
                        >
                          {invoice.status}
                        </Badge>
                      ) : null}
                    </SettingsRowTitle>
                    <SettingsRowDescription>
                      {formatShortDate(new Date(invoice.createdAt), {
                        locale: shellData.currentOrganization.locale,
                        timeFormatPreference:
                          shellData.currentOrganization.timeFormatPreference,
                        timeZone: shellData.currentOrganization.timezone,
                      })}{" "}
                      ·{" "}
                      {formatPriceFromCents(
                        invoice.amountPaidCents > 0
                          ? invoice.amountPaidCents
                          : invoice.amountDueCents,
                        invoice.currency,
                        shellData.currentOrganization.locale,
                      )}
                    </SettingsRowDescription>
                  </SettingsRowLabel>
                  {invoice.hostedInvoiceUrl ? (
                    <Button
                      render={
                        <a
                          aria-label={`View ${invoice.number ?? "invoice"} in Stripe`}
                          href={invoice.hostedInvoiceUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span className="sr-only">
                            View {invoice.number ?? "invoice"} in Stripe
                          </span>
                        </a>
                      }
                      size="sm"
                      variant="outline"
                    >
                      View
                    </Button>
                  ) : null}
                </SettingsRow>
              ))
            ) : (
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>No invoices yet</SettingsRowTitle>
                  <SettingsRowDescription>
                    Your invoice history will appear here after the first
                    successful payment.
                  </SettingsRowDescription>
                </SettingsRowLabel>
              </SettingsRow>
            )}
          </SettingsCard>
        </SettingsSection>
      </SettingsPageContent>
    </SettingsPage>
  )
}

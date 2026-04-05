import { Check, CreditCard, Lightning } from "@phosphor-icons/react/ssr";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  SettingsPage,
  SettingsPageTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import {
  WorkspaceCheckoutButton,
  WorkspaceManageBillingButton,
} from "@/app/[orgSlug]/settings/workspace/billing/_components/workspace-billing-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWorkspaceBillingOverview } from "@/db/billing";
import { getBillingPlans } from "@/lib/billing/plans";
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

const PLAN_DESCRIPTIONS: Record<string, string> = {
  basic_monthly: "For individuals getting started with Otto.",
  plus_monthly: "For growing teams with regular usage.",
  pro_monthly: "For teams that rely on Otto every day.",
  max_monthly: "For high-volume workspaces with dedicated needs.",
};

const PLAN_FEATURES: Record<string, string[]> = {
  basic_monthly: [
    "Monthly prepaid credits",
    "Managed in Stripe billing",
    "Auto-reload eligible",
  ],
  plus_monthly: [
    "Monthly prepaid credits",
    "Managed in Stripe billing",
    "Auto-reload eligible",
  ],
  pro_monthly: [
    "Monthly prepaid credits",
    "Priority support",
    "Auto-reload eligible",
  ],
  max_monthly: [
    "Monthly prepaid credits",
    "Dedicated support",
    "Auto-reload eligible",
  ],
};

export default async function WorkspaceBillingPlansPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization } = await loadOrganizationRouteContext(orgSlug);
  const billingOverview = await getWorkspaceBillingOverview({
    organizationId: currentOrganization.id,
  });
  const billingConfigured = hasStripeBillingConfig();
  const plans = getBillingPlans();
  const currentPlanKey = billingOverview.subscription?.planKey ?? null;

  return (
    <SettingsPage className="max-w-6xl">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <SettingsPageTitle>Plans</SettingsPageTitle>
          <p className="text-sm text-muted-foreground">
            Choose the plan that fits your workspace. You can switch plans or
            cancel at any time.
          </p>
        </div>

        {!billingConfigured ? (
          <Alert className="rounded-lg" variant="destructive">
            <AlertTitle>Stripe billing is not configured</AlertTitle>
            <AlertDescription>
              Configure Stripe before enabling plan selection for this
              workspace.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = currentPlanKey === plan.key;
            const features = PLAN_FEATURES[plan.key] ?? [
              "Monthly prepaid credits",
              "Managed in Stripe billing",
              "Auto-reload eligible",
            ];

            return (
              <div
                key={plan.key}
                className={`flex flex-col gap-5 rounded-4xl p-6 ring-1 ${
                  isCurrent
                    ? "ring-primary"
                    : "ring-foreground/5 dark:ring-foreground/10"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">{plan.name}</span>
                    {isCurrent ? (
                      <Badge variant="secondary">Current</Badge>
                    ) : null}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatPrice(plan.monthlyPriceUsd, currentOrganization.locale)}
                    /month
                  </span>
                </div>

                <div className="text-3xl font-semibold tracking-tight">
                  {formatCredits(plan.creditsIncluded, currentOrganization.locale)}
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    credits/month
                  </span>
                </div>

                <p className="text-sm text-muted-foreground">
                  {PLAN_DESCRIPTIONS[plan.key] ?? ""}
                </p>

                <div className="flex flex-col gap-2.5">
                  {features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Check className="size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-2">
                  {isCurrent ? (
                    <Button className="w-full" disabled variant="secondary">
                      Current plan
                    </Button>
                  ) : currentPlanKey ? (
                    <WorkspaceManageBillingButton
                      canOpenBillingPortal={Boolean(billingOverview.customer)}
                      className="w-full"
                      label={`Switch to ${plan.name}`}
                      orgSlug={orgSlug}
                      variant="outline"
                    />
                  ) : (
                    <WorkspaceCheckoutButton
                      canManageBilling={billingConfigured}
                      className="w-full"
                      label={`Switch to ${plan.name}`}
                      orgSlug={orgSlug}
                      planKey={plan.key}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground">
          Plan changes take effect immediately. Your existing credits carry over
          until the end of the current billing period. Payment, invoices, and
          cancellations are handled through Stripe.
        </p>
      </div>
    </SettingsPage>
  );
}

import { Check, CreditCard, Lightning } from "@phosphor-icons/react/ssr";
import Link from "next/link";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
        <div className="flex flex-col gap-3">
          <Button
            className="w-fit"
            render={<Link href={`/${orgSlug}/settings/workspace/billing`} />}
            size="sm"
            variant="ghost"
          >
            Back to billing
          </Button>
          <div className="flex flex-col gap-1">
            <SettingsPageTitle>Plans</SettingsPageTitle>
            <p className="text-sm text-muted-foreground">
              Compare plans here, then use Stripe to start or switch the
              subscription for this workspace.
            </p>
          </div>
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

        <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
          {plans.map((plan) => {
            const isCurrent = currentPlanKey === plan.key;

            return (
              <Card
                key={plan.key}
                className={isCurrent ? "border-primary shadow-sm" : undefined}
              >
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription>
                        {formatPrice(
                          plan.monthlyPriceUsd,
                          currentOrganization.locale,
                        )}
                        /month
                      </CardDescription>
                    </div>
                    {isCurrent ? <Badge>Current</Badge> : null}
                  </div>
                  <div className="text-3xl font-semibold tracking-tight">
                    {formatCredits(
                      plan.creditsIncluded,
                      currentOrganization.locale,
                    )}
                  </div>
                  <CardDescription>credits included each month</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="text-primary" />
                    <span>Monthly prepaid credits</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="text-primary" />
                    <span>Managed in Stripe billing</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Lightning className="text-primary" />
                    <span>Eligible for future auto-reload</span>
                  </div>
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <Button disabled variant="secondary">
                      Current plan
                    </Button>
                  ) : currentPlanKey ? (
                    <WorkspaceManageBillingButton
                      canOpenBillingPortal={Boolean(billingOverview.customer)}
                      label="Change in billing"
                      orgSlug={orgSlug}
                      variant="outline"
                    />
                  ) : (
                    <WorkspaceCheckoutButton
                      canManageBilling={billingConfigured}
                      label={`Choose ${plan.name}`}
                      orgSlug={orgSlug}
                      planKey={plan.key}
                    />
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How plan changes work</CardTitle>
            <CardDescription>
              Stripe manages payment methods, invoices, cancellations, and plan
              changes for subscribed workspaces.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Otto keeps your current-cycle credits in place. If this workspace
            already has a subscription, use Stripe billing to switch to another
            plan.
          </CardContent>
        </Card>
      </div>
    </SettingsPage>
  );
}

import {
  BILLING_PAID_PLAN_DEFINITIONS,
  FREE_PLAN_CREDITS,
} from "@otto/feature-billing"

import {
  billingPlanDescriptions,
  billingPlanFeatures,
} from "@/features/billing/plan-content"

import {
  LandingPageShell,
  LandingSection,
  LandingSectionEyebrow,
} from "../components/layout"

function formatCredits(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

export function LandingPricingPage() {
  return (
    <LandingPageShell>
      <LandingSection className="flex flex-col gap-10 pb-20 pt-16 md:pb-28 md:pt-20">
        <div className="max-w-3xl">
          <LandingSectionEyebrow>Pricing</LandingSectionEyebrow>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Join the waitlist
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Public account creation is paused. Join the waitlist and we will
            follow up when your team can start with{" "}
            {formatCredits(FREE_PLAN_CREDITS)} free credits.
          </p>
        </div>

        {/* Free tier */}
        <article className="rounded-lg border border-border/70 bg-background p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  Free
                </p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight">
                    $0
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
              </div>
              <p className="text-base text-muted-foreground">
                {billingPlanDescriptions.free}
              </p>
              <div className="text-2xl font-semibold tracking-tight">
                {formatCredits(FREE_PLAN_CREDITS)}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  credits/month
                </span>
              </div>
              <ul className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
                {(billingPlanFeatures.free ?? []).map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-foreground/30" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <a
                className="inline-flex whitespace-nowrap rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                href="/waitlist"
              >
                Join the Waitlist
              </a>
            </div>
          </div>
        </article>

        {/* Paid plans */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {BILLING_PAID_PLAN_DEFINITIONS.map((plan) => (
            <article
              className="flex flex-col gap-5 rounded-lg border border-border/70 bg-background p-6 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
              key={plan.key}
            >
              <div>
                <p className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  {plan.name}
                </p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight">
                    ${plan.monthlyPriceUsd}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
              </div>

              <div className="text-xl font-semibold tracking-tight">
                {formatCredits(plan.creditsIncluded)}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  credits/month
                </span>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                {billingPlanDescriptions[plan.key] ?? ""}
              </p>

              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {(billingPlanFeatures[plan.key] ?? []).map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-foreground/30" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-2">
                <a
                  className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                  href="/waitlist"
                >
                  Join the Waitlist
                </a>
              </div>
            </article>
          ))}
        </div>

        {/* Enterprise */}
        <article className="rounded-lg border border-border/70 bg-[#f7f4ef] p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Enterprise
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Need more?
              </h2>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                Custom volume, dedicated support, and security reviews for
                larger teams.
              </p>
            </div>
            <a
              className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-border/75 bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-background/80"
              href="/waitlist"
            >
              Join the Waitlist
            </a>
          </div>
        </article>

        <p className="text-sm text-muted-foreground">
          Plan changes take effect immediately. Payment, invoices, and
          cancellations are handled through Stripe.
        </p>
      </LandingSection>
    </LandingPageShell>
  )
}

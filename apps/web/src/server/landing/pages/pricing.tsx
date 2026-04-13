import {
  LandingPageShell,
  LandingSection,
  LandingSectionEyebrow,
} from "../components/layout"

export function LandingPricingPage() {
  return (
    <LandingPageShell>
      <LandingSection className="flex flex-col gap-10 pb-20 pt-16 md:pb-28 md:pt-20">
        <div className="max-w-3xl">
          <LandingSectionEyebrow>Pricing</LandingSectionEyebrow>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Start with one clear path into Otto
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Otto should start with a straightforward path for founder-led
            software teams that want help turning product momentum into a real
            operating system.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[2rem] border border-border/70 bg-background p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <p className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Core plan
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Start with the operating layer
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Use Otto when the product exists or is close, but onboarding,
              support, and follow-through still rely on scattered tools and
              founder memory.
            </p>
            <ul className="mt-8 flex flex-col gap-3 text-sm text-muted-foreground">
              <li>Shared workspace and business brief intake</li>
              <li>Operating context for onboarding, support, and execution</li>
              <li>Structured follow-through instead of manual handoffs</li>
            </ul>
            <div className="mt-8">
              <a
                className="inline-flex rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                href="/login"
              >
                Get started
              </a>
            </div>
          </article>

          <article className="rounded-[2rem] border border-border/70 bg-[#f7f4ef] p-8">
            <p className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Enterprise
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Add heavier packaging only when it is earned
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Security reviews, custom onboarding, and deeper policy support
              should follow real demand, not placeholder pricing tiers.
            </p>
          </article>
        </div>
      </LandingSection>
    </LandingPageShell>
  )
}

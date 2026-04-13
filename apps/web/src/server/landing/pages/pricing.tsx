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
            Otto should start with a straightforward self-serve path for teams
            that want to run the business around their product in one place.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[2rem] border border-border/60 bg-card/75 p-8 shadow-sm">
            <p className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Team
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Start with the business operating system
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Use Otto when the product already exists or is close, but the
              business around it still needs support, onboarding, operating
              rhythms, and execution systems.
            </p>
            <ul className="mt-8 flex flex-col gap-3 text-sm text-muted-foreground">
              <li>Shared workspace setup</li>
              <li>Managed business instructions and operating context</li>
              <li>Connected work surfaces and structured follow-through</li>
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

          <article className="rounded-[2rem] border border-border/60 bg-muted/35 p-8">
            <p className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Enterprise
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Add heavier packaging only when it is earned
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Security reviews, custom onboarding, and policy support should
              follow real enterprise demand, not placeholder pricing boxes.
            </p>
          </article>
        </div>
      </LandingSection>
    </LandingPageShell>
  )
}

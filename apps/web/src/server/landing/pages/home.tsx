import {
  LandingPageShell,
  LandingSection,
  LandingSectionEyebrow,
} from "../components/layout"
import { LandingPromptComposer } from "../components/prompt-composer"
import {
  landingCapabilityCards,
  landingHowItWorks,
  landingNumbers,
} from "../content/home"

export interface LandingHomePageProps {
  prompt?: string
}

export function LandingHomePage({ prompt }: LandingHomePageProps) {
  const finalPrompt =
    prompt ??
    "I have a SaaS product and need help building the business around it."

  return (
    <LandingPageShell
      footerPromptSlot={
        <div className="flex w-full max-w-4xl flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-3">
            <LandingSectionEyebrow>AI business operator</LandingSectionEyebrow>
            <h2 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Ready to run the business, not just ship the product?
            </h2>
          </div>
          <LandingPromptComposer
            examplesHeading="Or start with one of these business briefs"
            prompt={finalPrompt}
          />
        </div>
      }
    >
      <section className="relative overflow-hidden pb-16 pt-12 md:pb-24 md:pt-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(131,161,255,0.4),transparent_26%),radial-gradient(circle_at_20%_65%,rgba(124,156,255,0.32),transparent_24%),radial-gradient(circle_at_80%_70%,rgba(255,116,164,0.26),transparent_26%),linear-gradient(180deg,#ffffff_0%,rgba(244,247,255,0.96)_38%,rgba(128,154,255,0.16)_72%,rgba(255,111,142,0.14)_100%)]" />

        <LandingSection className="relative flex flex-col items-center gap-12 text-center">
          <div className="flex max-w-4xl flex-col items-center gap-5 pt-6 md:pt-12">
            <LandingSectionEyebrow>
              Otto for software businesses
            </LandingSectionEyebrow>
            <h1 className="max-w-5xl text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
              Otto is the AI that runs your software business
            </h1>
            <p className="max-w-3xl text-xl font-medium tracking-tight text-foreground/82 sm:text-2xl">
              Developing software is solved. Running a software business is not.
            </p>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              Otto helps founders and teams start and run the business around
              the product: support, onboarding, operations, workflows, and
              execution.
            </p>
          </div>

          {/* biome-ignore lint/correctness/useUniqueElementIds: static SSR anchor target for marketing navigation */}
          <div className="w-full" id="start">
            <LandingPromptComposer prompt={prompt} />
          </div>
        </LandingSection>
      </section>

      {/* biome-ignore lint/correctness/useUniqueElementIds: static SSR anchor target for landing navigation */}
      <LandingSection
        className="grid gap-6 pb-18 md:grid-cols-3 md:gap-8 md:pb-24"
        id="product"
      >
        {landingNumbers.map((item) => (
          <article
            className="flex min-h-[220px] flex-col justify-between rounded-[2rem] border border-border/60 bg-card/75 px-6 py-6 shadow-sm"
            key={item.value}
          >
            <p className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {item.value}
            </p>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          </article>
        ))}
      </LandingSection>

      {/* biome-ignore lint/correctness/useUniqueElementIds: static SSR anchor target for landing navigation */}
      <LandingSection className="pb-18 md:pb-24" id="how-it-works">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="rounded-[2.25rem] border border-border/60 bg-card/70 p-6 shadow-sm sm:p-8">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-border/55 bg-[linear-gradient(135deg,rgba(255,120,84,0.22),rgba(138,149,255,0.26)_48%,rgba(255,122,169,0.24))] p-6">
              <div className="rounded-[1.4rem] border border-white/45 bg-background/78 p-5 shadow-[0_18px_50px_rgba(109,120,255,0.16)] backdrop-blur">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Otto operating brief</span>
                  <span>From idea to operation</span>
                </div>
                <div className="mt-5 flex flex-col gap-4">
                  <div className="rounded-[1.25rem] bg-foreground/5 p-4">
                    <p className="text-sm font-medium text-foreground">
                      Start with the business, not another stack of scattered
                      prompts.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.2rem] border border-border/60 bg-background/85 p-4">
                      <p className="text-sm font-medium text-foreground">
                        Customers
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        onboarding, support, retention
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-border/60 bg-background/85 p-4">
                      <p className="text-sm font-medium text-foreground">
                        Operations
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        workflows, handoffs, execution
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex max-w-xl flex-col gap-4">
              <LandingSectionEyebrow>Meet Otto</LandingSectionEyebrow>
              <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Start with the business, not just the build
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                The product is only one part of a software business. Otto helps
                shape the support, onboarding, execution, and operating systems
                around it.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {landingHowItWorks.map((item) => (
                <article className="flex gap-4" key={item.step}>
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/65 bg-background text-sm font-medium text-muted-foreground">
                    {item.step}
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                      {item.title}
                    </h3>
                    <p className="max-w-xl text-base leading-7 text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </LandingSection>

      {/* biome-ignore lint/correctness/useUniqueElementIds: static SSR anchor target for landing navigation */}
      <LandingSection className="pb-18 md:pb-24" id="examples">
        <div className="flex max-w-3xl flex-col gap-4">
          <LandingSectionEyebrow>What Otto helps you run</LandingSectionEyebrow>
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            From first customer to recurring business operations
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            Otto is meant to help run the business around the product, not just
            generate code or draft one-off answers.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {landingCapabilityCards.map((card) => (
            <article
              className="rounded-[2rem] border border-border/60 bg-card/70 px-6 py-6 shadow-sm"
              key={card.title}
            >
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                {card.title}
              </h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {card.description}
              </p>
            </article>
          ))}
        </div>
      </LandingSection>
    </LandingPageShell>
  )
}

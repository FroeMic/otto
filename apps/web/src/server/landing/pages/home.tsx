import {
  LandingPageShell,
  LandingSection,
  LandingSectionEyebrow,
} from "../components/layout"
import { LandingPromptComposer } from "../components/prompt-composer"
import {
  landingAudienceCards,
  landingHowItWorks,
  landingOperatingPillars,
  landingPainCards,
} from "../content/home"

export interface LandingHomePageProps {
  prompt?: string
}

export function LandingHomePage({ prompt }: LandingHomePageProps) {
  const finalPrompt =
    prompt ?? "Help me set up the business operations around my SaaS product."

  return (
    <LandingPageShell
      footerPromptSlot={
        <div className="flex w-full max-w-4xl flex-col items-center gap-5 text-center">
          <div className="flex flex-col gap-3">
            <LandingSectionEyebrow>
              Start with one business brief
            </LandingSectionEyebrow>
            <h2 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Tell Otto what you are building and what is breaking down
            </h2>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              The chat window is the fastest path in. Tomorrow the live
              qualification loop plugs into the same surface.
            </p>
          </div>
          <LandingPromptComposer
            examplesHeading="Or start with one of these business briefs"
            prompt={finalPrompt}
          />
        </div>
      }
    >
      <section className="relative overflow-hidden border-b border-border/45 pb-18 pt-12 md:pb-24 md:pt-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(132,154,255,0.16),transparent_28%),radial-gradient(circle_at_18%_78%,rgba(126,151,255,0.08),transparent_20%),radial-gradient(circle_at_82%_76%,rgba(255,147,109,0.08),transparent_18%)]" />

        <LandingSection className="relative flex flex-col items-center gap-12 text-center">
          <div className="flex max-w-5xl flex-col items-center gap-5 pt-6 md:pt-12">
            <LandingSectionEyebrow>
              Otto for founder-led software businesses
            </LandingSectionEyebrow>
            <h1 className="max-w-5xl text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
              Build the product. Otto helps build the business.
            </h1>
            <p className="max-w-4xl text-xl font-medium tracking-tight text-foreground/84 sm:text-2xl">
              Building software is getting solved. Running the business is not.
            </p>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              Otto helps founders move from idea to launch to first revenue by
              bringing onboarding, support, handoffs, and follow-through into
              one operating layer.
            </p>
          </div>

          {/* biome-ignore lint/correctness/useUniqueElementIds: static SSR anchor target for marketing navigation */}
          <div className="mx-auto w-full" id="start">
            <LandingPromptComposer prompt={prompt} />
          </div>
        </LandingSection>
      </section>

      {/* biome-ignore lint/correctness/useUniqueElementIds: static SSR anchor target for landing navigation */}
      <LandingSection className="pb-18 pt-18 md:pb-24 md:pt-24" id="for-whom">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 text-center">
          <LandingSectionEyebrow>Who Otto is for</LandingSectionEyebrow>
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Founder-led teams with product momentum and messy business ops
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            Otto is not for every company shape on day one. It is for founders
            and small software teams that can ship product but still need help
            turning that momentum into a functioning business.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-6 md:grid-cols-3">
          {landingAudienceCards.map((card) => (
            <article
              className="rounded-[1.5rem] border border-border/70 bg-background px-6 py-6 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
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

      <LandingSection className="pb-18 md:pb-24">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 text-center">
          <LandingSectionEyebrow>
            Where founders get stuck
          </LandingSectionEyebrow>
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            The business side stays fragmented long after the product works
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            That is the gap Otto is meant to close first. Not strategy theater.
            Not another pile of disconnected prompts. Actual operating
            follow-through.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-6 md:grid-cols-3">
          {landingPainCards.map((card) => (
            <article
              className="rounded-[1.5rem] border border-border/70 bg-[#fdfcf8] px-6 py-6 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
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

      {/* biome-ignore lint/correctness/useUniqueElementIds: static SSR anchor target for landing navigation */}
      <LandingSection className="pb-18 md:pb-24" id="how-it-works">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <div className="flex flex-col gap-5">
            <LandingSectionEyebrow>How Otto helps</LandingSectionEyebrow>
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              From one business brief to a clearer next move
            </h2>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              The interaction model is simple: start with the business. Otto
              helps qualify the operating gaps, the next step, and the system
              needed around the product.
            </p>

            <div className="mt-2 flex flex-col gap-6">
              {landingHowItWorks.map((item) => (
                <article className="flex gap-4" key={item.step}>
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-sm font-medium text-muted-foreground">
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

          <div className="rounded-[1.5rem] border border-border/70 bg-background p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
            <div className="rounded-[1.2rem] border border-border/65 bg-[#f7f4ef] p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Otto operating brief</span>
                <span>Qualify the next step</span>
              </div>

              <div className="mt-5 rounded-[1rem] border border-border/65 bg-background px-4 py-4">
                <p className="text-sm font-medium leading-6 text-foreground">
                  We launched our SaaS, but onboarding, support, and follow-up
                  are still handled manually by the founders.
                </p>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-[1rem] border border-border/65 bg-background px-4 py-4">
                  <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                    What Otto sees
                  </p>
                  <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground">
                    <li>Onboarding lacks clear ownership</li>
                    <li>Support context is fragmented</li>
                    <li>Follow-through relies on founder memory</li>
                  </ul>
                </div>

                <div className="rounded-[1rem] border border-border/65 bg-background px-4 py-4">
                  <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                    What Otto helps run
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {landingOperatingPillars.map((pillar) => (
                      <div
                        className="rounded-[0.85rem] border border-border/60 bg-[#fdfcf8] px-3 py-3"
                        key={pillar.title}
                      >
                        <p className="text-sm font-medium text-foreground">
                          {pillar.title}
                        </p>
                        <p className="mt-2 text-xs leading-6 text-muted-foreground">
                          {pillar.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </LandingSection>

      {/* biome-ignore lint/correctness/useUniqueElementIds: static SSR anchor target for landing navigation */}
      <LandingSection className="pb-20 md:pb-28" id="proof">
        <div className="mx-auto max-w-6xl rounded-[1.5rem] border border-border/70 bg-background px-8 py-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="flex flex-col gap-4 text-center lg:text-left">
              <LandingSectionEyebrow>
                What Otto helps you run
              </LandingSectionEyebrow>
              <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                The business layer after the product ships
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                Otto is not meant to replace your product. It is meant to help
                founders run the systems that make the product a real business.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {landingOperatingPillars.map((pillar) => (
                <article
                  className="rounded-[1.1rem] border border-border/70 bg-[#f7f4ef] px-5 py-5"
                  key={pillar.title}
                >
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {pillar.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </LandingSection>
    </LandingPageShell>
  )
}

import {
  type LandingHeaderViewer,
  LandingPageShell,
  LandingSection,
} from "../components/layout"
import { LandingPromptComposer } from "../components/prompt-composer"

export interface LandingHomePageProps {
  authModalSlot?: React.ReactNode
  prompt?: string
  viewer?: LandingHeaderViewer | null
}

export function LandingHomePage({
  authModalSlot,
  prompt,
  viewer = null,
}: LandingHomePageProps) {
  const finalPrompt =
    prompt ?? "Help me set up the business operations around my SaaS product."

  return (
    <LandingPageShell overlaySlot={authModalSlot} viewer={viewer}>
      <section className="relative overflow-hidden border-b border-border/45 pb-20 pt-16 md:pb-28 md:pt-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(132,154,255,0.18),transparent_28%),radial-gradient(circle_at_16%_72%,rgba(255,147,109,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.3),rgba(250,248,243,0))]" />

        <LandingSection className="relative flex flex-col items-center gap-10 text-center">
          <div className="flex max-w-5xl flex-col items-center gap-6 pt-8 md:pt-14">
            <h1 className="max-w-5xl text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
              An AI employee for your team.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Otto helps founder-led software businesses handle onboarding,
              support, handoffs, and follow-through in one place.
            </p>
          </div>

          {/* biome-ignore lint/correctness/useUniqueElementIds: static SSR anchor target for marketing navigation */}
          <div className="mx-auto w-full max-w-4xl" id="start">
            <LandingPromptComposer
              examplesHeading="Or start with one of these"
              prompt={finalPrompt}
            />
          </div>
        </LandingSection>
      </section>
    </LandingPageShell>
  )
}

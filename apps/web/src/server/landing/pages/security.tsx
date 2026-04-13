import {
  LandingPageShell,
  LandingSection,
  LandingSectionEyebrow,
} from "../components/layout"

const securityCards = [
  {
    body: "Keep instructions, configuration, and connected surfaces in one visible workspace instead of scattered prompts and hidden operational state.",
    title: "Visible operating controls",
  },
  {
    body: "Make it explicit where Otto can act, how it behaves, and which connected systems it can use.",
    title: "Explicit integration behavior",
  },
  {
    body: "Keep the trust story legible and only expand claims once the underlying posture and process are real.",
    title: "Credible scope first",
  },
] as const

export function LandingSecurityPage() {
  return (
    <LandingPageShell>
      <LandingSection className="flex flex-col gap-10 pb-20 pt-16 md:pb-28 md:pt-20">
        <div className="max-w-3xl">
          <LandingSectionEyebrow>Security</LandingSectionEyebrow>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Make the trust story operationally legible
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Otto should make operating controls, connected systems, and runtime
            behavior visible early, instead of treating security as a vague
            afterthought.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {securityCards.map((card) => (
            <article
              className="rounded-[2rem] border border-border/60 bg-card/75 p-8 shadow-sm"
              key={card.title}
            >
              <h2 className="text-2xl font-semibold tracking-tight">
                {card.title}
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {card.body}
              </p>
            </article>
          ))}
        </div>
      </LandingSection>
    </LandingPageShell>
  )
}

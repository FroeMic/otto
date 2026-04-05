import Link from "next/link"

import { buttonVariants } from "@/lib/button-variants"
import { cn } from "@/lib/utils"

const capabilityCards = [
  {
    title: "Work from the tools your team already uses",
    description:
      "Give Otto the context it needs in your workspace and let it operate from connected tools instead of isolated prompts.",
  },
  {
    title: "Handle recurring work without babysitting it",
    description:
      "Use Otto for updates, follow-through, and repetitive coordination work that normally leaks across chat, docs, and tabs.",
  },
  {
    title: "Keep one shared memory for the team",
    description:
      "Otto gets better when it has stable workspace context, settings, and instructions instead of starting from zero every time.",
  },
]

const previewCards = [
  {
    eyebrow: "Workspace setup",
    title: "Manage Otto in one place",
    description:
      "Set instructions, review connected surfaces, and keep the workspace configuration visible instead of buried in prompts.",
  },
  {
    eyebrow: "Channels and tools",
    title: "Connect the work surface, not just the model",
    description:
      "Bring Otto into the team environment where work already happens and control how it responds, where it responds, and what it can use.",
  },
]

export default function Page() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(circle_at_top,oklch(from_var(--primary)_l_c_h_/_0.18),transparent_62%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_bottom,transparent,oklch(from_var(--background)_l_c_h_/_1))]" />

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 py-8 md:px-10 lg:px-12 lg:py-10">
          <header className="flex items-center justify-between gap-6">
            <Link href="/" className="font-medium tracking-tight">
              Otto
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              <Link
                href="/pricing"
                className="transition-colors hover:text-foreground"
              >
                Pricing
              </Link>
              <Link
                href="/security"
                className="transition-colors hover:text-foreground"
              >
                Security
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link
                href="https://app.getyourotto.com/login"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Log in
              </Link>
              <Link
                href="https://app.getyourotto.com/login"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Open workspace
              </Link>
            </div>
          </header>

          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,32rem)] lg:gap-16">
            <div className="flex flex-col gap-7">
              <div className="inline-flex w-fit rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium tracking-[0.18em] text-primary uppercase">
                Warm, controlled AI for real team work
              </div>
              <div className="max-w-3xl">
                <h1 className="text-5xl font-semibold tracking-tight text-pretty sm:text-6xl lg:text-7xl">
                  Otto helps your team get work done, not just generate text.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Set up Otto in your workspace, connect the surfaces that
                  matter, and give your team one shared assistant that can
                  actually follow through.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="https://app.getyourotto.com/login"
                  className={cn(buttonVariants({ size: "lg" }))}
                >
                  Get started
                </Link>
                <Link
                  href="/security"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" })
                  )}
                >
                  View security
                </Link>
              </div>

              <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                <div className="rounded-3xl border border-border/70 bg-card/70 px-4 py-3 backdrop-blur">
                  Shared workspace context
                </div>
                <div className="rounded-3xl border border-border/70 bg-card/70 px-4 py-3 backdrop-blur">
                  Managed tool access
                </div>
                <div className="rounded-3xl border border-border/70 bg-card/70 px-4 py-3 backdrop-blur">
                  Light and dark friendly by default
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-[2rem] bg-primary/12 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/95 shadow-[0_32px_120px_-48px_oklch(from_var(--foreground)_l_c_h_/_0.45)] backdrop-blur">
                <div className="border-b border-border/70 px-5 py-4">
                  <p className="text-sm font-medium">Otto workspace preview</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Setup, controls, and real product surfaces instead of a
                    generic marketing mockup.
                  </p>
                </div>
                <div className="grid gap-4 p-5">
                  <div className="rounded-[1.5rem] border border-border/70 bg-background/90 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          Workspace settings
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Keep Otto instructions, integrations, and runtime
                          behavior visible in one place.
                        </p>
                      </div>
                      <div className="rounded-full bg-primary/12 px-3 py-1 text-xs font-medium text-primary">
                        Active
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-2xl bg-muted/70 p-3">
                        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                          Otto instructions
                        </p>
                        <p className="mt-2 text-sm">
                          Keep answers concise, act on connected tools
                          carefully, and surface changes before applying them.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-muted/70 p-3">
                          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                            Connected surface
                          </p>
                          <p className="mt-2 text-sm">
                            Slack configured for workspace use
                          </p>
                        </div>
                        <div className="rounded-2xl bg-muted/70 p-3">
                          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                            Search tool
                          </p>
                          <p className="mt-2 text-sm">
                            Web search available with policy control
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[1.5rem] border border-border/70 bg-muted/45 p-4">
                      <p className="text-sm font-medium">Activity snapshot</p>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl bg-background/80 p-3 text-sm">
                          Summarized channel activity and produced a draft
                          follow-up.
                        </div>
                        <div className="rounded-2xl bg-background/80 p-3 text-sm">
                          Updated workspace policy after a settings change.
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[1.5rem] border border-border/70 bg-primary/9 p-4">
                      <p className="text-sm font-medium">
                        Why this feels different
                      </p>
                      <ul className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
                        <li>Shared memory for the team</li>
                        <li>Clear workspace controls</li>
                        <li>Real surfaces, not isolated chat</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-[2rem] border border-border/70 bg-card/65 p-4 text-sm text-muted-foreground backdrop-blur sm:grid-cols-3">
            <div className="rounded-[1.25rem] bg-background/85 px-4 py-3">
              Product-first presentation
            </div>
            <div className="rounded-[1.25rem] bg-background/85 px-4 py-3">
              Soft, warm Otto visual language
            </div>
            <div className="rounded-[1.25rem] bg-background/85 px-4 py-3">
              Minimal scope, ready for experiments
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-18 md:px-10 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
            What Otto does
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            A practical assistant for prosumer teams
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            The first public page should make Otto feel concrete. That means
            showing clear use, visible controls, and enough product texture to
            feel trustworthy without burying the visitor in content.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {capabilityCards.map((card) => (
            <article
              key={card.title}
              className="rounded-[2rem] border border-border/70 bg-card px-6 py-6 shadow-sm"
            >
              <h3 className="text-lg font-medium tracking-tight">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {card.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border/70 bg-muted/30">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-6 py-18 md:px-10 lg:grid-cols-2 lg:px-12">
          {previewCards.map((card) => (
            <article
              key={card.title}
              className="rounded-[2rem] border border-border/70 bg-background/90 p-6"
            >
              <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                {card.eyebrow}
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                {card.title}
              </h3>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                {card.description}
              </p>
              <div className="mt-6 rounded-[1.5rem] border border-border/70 bg-card p-4">
                <div className="grid gap-3">
                  <div className="h-24 rounded-[1.25rem] bg-[linear-gradient(135deg,oklch(from_var(--primary)_l_c_h_/_0.18),transparent_70%)]" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="h-20 rounded-[1.25rem] bg-muted/70" />
                    <div className="h-20 rounded-[1.25rem] bg-muted/70" />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-18 md:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12">
        <article className="rounded-[2rem] border border-border/70 bg-card px-6 py-6">
          <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Start simple, then expand
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            The first release does not need a complicated pricing story. A
            single self-serve path plus an enterprise contact path is enough
            while the product surface is still tightening.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="https://app.getyourotto.com/login"
              className={cn(buttonVariants())}
            >
              Start with Otto
            </Link>
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              View pricing
            </Link>
          </div>
        </article>

        <article className="rounded-[2rem] border border-border/70 bg-primary/8 px-6 py-6">
          <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
            Security
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Confidence before expansion
          </h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Public pages should make the data posture legible early. Keep the
            message short, true, and easy to verify.
          </p>
          <ul className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground">
            <li>Encrypted credentials and managed workspace settings</li>
            <li>Clear control over where Otto can operate</li>
            <li>Visible runtime and integration configuration</li>
          </ul>
        </article>
      </section>

      <section className="px-6 pb-10 md:px-10 lg:px-12 lg:pb-14">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 rounded-[2rem] border border-border/70 bg-card px-6 py-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
              Ready for the first release
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Ship the minimal public site, then optimize from real data.
            </h2>
          </div>
          <Link
            href="https://app.getyourotto.com/login"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Open workspace
          </Link>
        </div>
      </section>
    </main>
  )
}

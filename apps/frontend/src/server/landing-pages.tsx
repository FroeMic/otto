import { buttonVariants } from "../shared/button-variants"
import { cn } from "../shared/cn"

function LandingHeader() {
  return (
    <header className="flex items-center justify-between gap-4">
      <a href="/" className="font-medium tracking-tight">
        Otto
      </a>
      <a href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
        Open workspace
      </a>
    </header>
  )
}

export function LandingHomePage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="flex w-full max-w-xl flex-col items-center gap-6 rounded-[2rem] border border-border/70 bg-card px-8 py-12 text-center shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Otto
          </p>
          <p className="text-xs tracking-[0.2em] text-primary uppercase">
            New frontend preview
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Public site placeholder
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Use the workspace app to sign in.
          </p>
        </div>

        <a href="/login" className={cn(buttonVariants({ size: "lg" }))}>
          Go to app login
        </a>
      </div>
    </main>
  )
}

export function LandingPricingPage() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10 md:px-10 lg:px-12 lg:py-14">
        <LandingHeader />

        <section className="max-w-3xl">
          <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
            Pricing
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Keep the first pricing story simple.
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            The first public release should avoid fake precision. Start with one
            clear self-serve path, leave room for enterprise conversations, and
            tighten the pricing story as usage patterns become real.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-border/70 bg-card p-6">
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
              Team
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Start with the workspace path
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Give teams a straightforward way to try Otto in a real workspace
              before layering in more packaging complexity.
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground">
              <li>Shared workspace setup</li>
              <li>Managed settings and instructions</li>
              <li>Connected work surfaces and tool access</li>
            </ul>
            <div className="mt-6">
              <a href="/login" className={cn(buttonVariants())}>
                Get started
              </a>
            </div>
          </article>

          <article className="rounded-[2rem] border border-border/70 bg-primary/8 p-6">
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
              Enterprise
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Add a sales path later if it becomes necessary.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Security review support, onboarding help, and policy controls can
              live here once there is a real enterprise motion behind them.
            </p>
          </article>
        </section>
      </div>
    </main>
  )
}

export function LandingSecurityPage() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10 md:px-10 lg:px-12 lg:py-14">
        <LandingHeader />

        <section className="max-w-3xl">
          <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
            Security
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Make the trust story legible early.
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            The first marketing site should say only what Otto can support
            today: managed workspace settings, visible controls, and a product
            shape that treats operational clarity as part of the experience.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-[2rem] border border-border/70 bg-card p-6">
            <h2 className="text-xl font-semibold tracking-tight">
              Managed workspace controls
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Keep instructions, configuration, and connected surfaces in one
              visible workspace instead of hiding them in scattered prompts.
            </p>
          </article>

          <article className="rounded-[2rem] border border-border/70 bg-card p-6">
            <h2 className="text-xl font-semibold tracking-tight">
              Explicit integration behavior
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Decide where Otto should operate, how it should respond, and what
              tools it should have access to.
            </p>
          </article>

          <article className="rounded-[2rem] border border-border/70 bg-card p-6">
            <h2 className="text-xl font-semibold tracking-tight">
              Clear runtime visibility
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Product operations are easier to trust when the workspace makes
              deployment and surface state visible instead of magical.
            </p>
          </article>

          <article className="rounded-[2rem] border border-border/70 bg-primary/8 p-6">
            <h2 className="text-xl font-semibold tracking-tight">
              Tighten claims as the posture hardens
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Expand this page later with compliance and process detail only
              when those claims are fully supportable.
            </p>
          </article>
        </section>
      </div>
    </main>
  )
}

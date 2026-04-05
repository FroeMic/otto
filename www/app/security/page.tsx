import Link from "next/link"

import { buttonVariants } from "@/lib/button-variants"
import { cn } from "@/lib/utils"

export default function SecurityPage() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10 md:px-10 lg:px-12 lg:py-14">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="font-medium tracking-tight">
            Otto
          </Link>
          <Link
            href="https://app.getyourotto.com/login"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Open workspace
          </Link>
        </header>

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

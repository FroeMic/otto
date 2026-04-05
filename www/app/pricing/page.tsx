import Link from "next/link"

import { buttonVariants } from "@/lib/button-variants"
import { cn } from "@/lib/utils"

export default function PricingPage() {
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
              <Link
                href="https://app.getyourotto.com/login"
                className={cn(buttonVariants())}
              >
                Get started
              </Link>
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

import { Button } from "@/components/ui/button"

import { PlatformShell } from "../app-shell/PlatformShell"

export interface PlatformPageProps {}

export function PlatformPage(_props: PlatformPageProps) {
  return (
    <PlatformShell>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
          Platform
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Platform shell is mounted
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          This route is now a separate lazy-loaded layout surface inside the
          SPA, ready for the operator pages to move over incrementally.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm">
          <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
            Route
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            /platform
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Lazy-loaded as a distinct operator surface.
          </p>
        </section>

        <section className="rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm">
          <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
            Next cut
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            Operator pages
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Organizations, detail views, and queued actions can move in one
            slice at a time without reworking the shell again.
          </p>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <a className="inline-flex" href="/">
          <Button variant="outline">Back to home</Button>
        </a>
        <a className="inline-flex" href="/login?returnTo=%2Fplatform">
          <Button>Sign in for platform</Button>
        </a>
      </div>
    </PlatformShell>
  )
}

import { Button } from "@/components/ui/button"

export interface PlatformAuthRequiredPageProps {
  message?: string
}

export function PlatformAuthRequiredPage({
  message,
}: PlatformAuthRequiredPageProps) {
  const returnTo = encodeURIComponent("/platform/organizations")

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="flex w-full max-w-xl flex-col gap-5 rounded-[2rem] border border-border/70 bg-card px-8 py-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
            Platform
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Sign in to open the operator UI
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {message ?? "Your workspace session has expired."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            className="inline-flex"
            href={`/auth/sign-in?returnTo=${returnTo}`}
          >
            <Button>Sign in</Button>
          </a>
          <a className="inline-flex" href="/">
            <Button variant="outline">Back to home</Button>
          </a>
        </div>
      </div>
    </main>
  )
}

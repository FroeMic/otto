import { Button } from "@/components/ui/button"

export function RootPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="flex w-full max-w-3xl flex-col gap-5 rounded-[2rem] border border-border/70 bg-card px-8 py-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
            Otto
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Workspace SPA foundation
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Public routes stay server-rendered. The authenticated SPA now owns
            workspace slug routes and the platform area.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/login" className="inline-flex">
            <Button size="lg">Sign in</Button>
          </a>
          <a href="/" className="inline-flex">
            <Button variant="outline" size="lg">
              Back to home
            </Button>
          </a>
        </div>
      </div>
    </main>
  )
}

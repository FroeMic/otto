import { useSuspenseQuery } from "@tanstack/react-query"

import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"

export interface WorkspaceOverviewPageProps {
  orgSlug: string
}

export function WorkspaceOverviewPage({
  orgSlug,
}: WorkspaceOverviewPageProps) {
  const { data } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
          Workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {data.currentOrganization.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          The SPA shell is now mounted on the real workspace slug route.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm">
          <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
            Workspace URL
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            /{data.currentOrganization.slug}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Reserved-path handling now leaves this top-level slug to the SPA.
          </p>
        </section>

        <section className="rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm">
          <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
            Status
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {data.currentOrganization.isReady ? "Ready" : "Setup in progress"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Settings and navigation now share one persistent workspace layout.
          </p>
        </section>
      </div>
    </div>
  )
}

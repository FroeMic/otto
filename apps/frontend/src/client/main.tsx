import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { StrictMode, useEffect, useId, useState } from "react"
import { createRoot } from "react-dom/client"

import { buttonVariants } from "../shared/button-variants"
import { cn } from "../shared/cn"
import {
  getDefaultUsageSearch,
  shellBootstrapQueryOptions,
  updateWorkspaceSettings,
  usageOverviewQueryOptions,
  usageSearchSchema,
} from "./api"
import "./styles.css"

const queryClient = new QueryClient()

function RootPage() {
  return (
    <main className="min-h-svh bg-background px-6 py-16 text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-[2rem] border border-border/70 bg-card px-8 py-10 shadow-sm">
        <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
          Otto Workspace
        </p>
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            New shell in progress
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            The workspace shell now runs as a TanStack Router SPA against the
            new API boundary. Open a workspace route directly to test the first
            migrated slices.
          </p>
        </div>
        <div className="flex gap-3">
          <a href="/login" className={cn(buttonVariants())}>
            Sign in
          </a>
          <a href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to home
          </a>
        </div>
      </div>
    </main>
  )
}

function WorkspaceShell() {
  const { orgSlug } = orgRoute.useParams()
  const { data } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-8 px-6 py-8 md:px-10">
        <header className="flex items-center justify-between gap-4 rounded-[2rem] border border-border/70 bg-card px-5 py-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/12" />
            <div>
              <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                Otto
              </p>
              <p className="text-sm text-muted-foreground">
                {data.currentOrganization.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{data.user.name}</p>
              <p className="text-xs text-muted-foreground">{data.user.email}</p>
            </div>
            <a
              href="/login"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Auth
            </a>
          </div>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-border/70 bg-card px-5 py-6 shadow-sm">
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
              Workspace
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              {data.currentOrganization.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.currentOrganization.slug}
            </p>
            <nav className="mt-6 flex flex-col gap-2">
              {[
                { to: "/$orgSlug/usage", label: "Usage" },
                { to: "/$orgSlug/settings/workspace", label: "Settings" },
              ].map((item) => (
                <Link
                  key={item.label}
                  params={{ orgSlug }}
                  to={item.to}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "justify-start",
                  )}
                  activeProps={{
                    className: cn(buttonVariants(), "justify-start"),
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-8 border-t border-border/70 pt-6">
              <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
                Workspaces
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {data.organizations.map((organization) => (
                  <Link
                    key={organization.id}
                    params={{ orgSlug: organization.slug }}
                    to="/$orgSlug/usage"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "justify-start px-3 text-left",
                    )}
                  >
                    <span className="truncate">{organization.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          <div className="rounded-[2rem] border border-border/70 bg-card px-6 py-6 shadow-sm">
            <Outlet />
          </div>
        </section>
      </div>
    </main>
  )
}

function WorkspaceLandingPage() {
  const navigate = useNavigate({ from: "/$orgSlug/" })
  const { orgSlug } = orgRoute.useParams()

  useEffect(() => {
    void navigate({
      params: { orgSlug },
      to: "/$orgSlug/usage",
    })
  }, [navigate, orgSlug])

  return (
    <div className="flex min-h-[20rem] items-center justify-center text-sm text-muted-foreground">
      Loading workspace…
    </div>
  )
}

function WorkspaceUsagePage() {
  const search = usageRoute.useSearch()
  const { orgSlug } = orgRoute.useParams()
  const normalizedSearch = {
    ...getDefaultUsageSearch(),
    ...search,
  }
  const { data } = useSuspenseQuery(
    usageOverviewQueryOptions(orgSlug, normalizedSearch),
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
          Usage
        </p>
        <h2 className="text-3xl font-semibold tracking-tight">
          Workspace usage overview
        </h2>
        <p className="text-sm text-muted-foreground">
          Read-heavy slice running through the new shell.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Requests", data.summary.totalRequests],
          ["Input tokens", data.summary.totalInputTokens],
          ["Output tokens", data.summary.totalOutputTokens],
          ["Credits burned", data.summary.totalCreditsBurnedMilli / 1000],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[1.5rem] border border-border/70 bg-background/60 px-4 py-4"
          >
            <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
              {label}
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {Intl.NumberFormat().format(Number(value))}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-background/60">
        <div className="border-b border-border/70 px-5 py-4">
          <h3 className="text-lg font-semibold tracking-tight">Top models</h3>
        </div>
        <div className="divide-y divide-border/70">
          {data.usageByModel.length === 0 ? (
            <div className="px-5 py-8 text-sm text-muted-foreground">
              No usage data for the selected range.
            </div>
          ) : (
            data.usageByModel.slice(0, 8).map((row) => (
              <div
                key={`${row.provider ?? "unknown"}-${row.model}`}
                className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_8rem_8rem]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.model}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.provider ?? "unknown provider"}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {Intl.NumberFormat().format(row.requests ?? 0)} requests
                </div>
                <div className="text-sm text-muted-foreground">
                  {Intl.NumberFormat().format(row.inputTokens ?? 0)} in
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function WorkspaceSettingsPage() {
  const router = useRouter()
  const { orgSlug } = orgRoute.useParams()
  const { data } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))
  const nameFieldId = useId()
  const slugFieldId = useId()
  const [name, setName] = useState(data.currentOrganization.name)
  const [slug, setSlug] = useState(data.currentOrganization.slug)
  const mutation = useMutation({
    mutationFn: async (
      input:
        | { action: "update-name"; value: string }
        | { action: "update-slug"; value: string },
    ) => {
      if (input.action === "update-name") {
        return updateWorkspaceSettings(orgSlug, {
          action: "update-name",
          name: input.value,
        })
      }

      return updateWorkspaceSettings(orgSlug, {
        action: "update-slug",
        slug: input.value,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["shell-bootstrap", orgSlug],
      })
      await router.invalidate()
    },
  })

  useEffect(() => {
    setName(data.currentOrganization.name)
    setSlug(data.currentOrganization.slug)
  }, [data.currentOrganization.name, data.currentOrganization.slug])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
          Settings
        </p>
        <h2 className="text-3xl font-semibold tracking-tight">
          Workspace settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Write-heavy slice running through the new shell.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/60 px-5 py-5">
          <label className="text-sm font-medium" htmlFor={nameFieldId}>
            Workspace name
          </label>
          <input
            id={nameFieldId}
            className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="mt-4 flex justify-end">
            <Link
              to="."
              className={cn(buttonVariants())}
              onClick={(event) => {
                event.preventDefault()
                mutation.mutate({
                  action: "update-name",
                  value: name,
                })
              }}
            >
              {mutation.isPending ? "Saving…" : "Save name"}
            </Link>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-border/70 bg-background/60 px-5 py-5">
          <label className="text-sm font-medium" htmlFor={slugFieldId}>
            Workspace URL slug
          </label>
          <input
            id={slugFieldId}
            className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
          <div className="mt-4 flex justify-end">
            <Link
              to="."
              className={cn(buttonVariants())}
              onClick={(event) => {
                event.preventDefault()
                mutation.mutate({
                  action: "update-slug",
                  value: slug,
                })
              }}
            >
              {mutation.isPending ? "Saving…" : "Save slug"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

const rootRoute = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: Outlet,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  component: RootPage,
  path: "/",
})

const orgRoute = createRoute({
  getParentRoute: () => rootRoute,
  component: WorkspaceShell,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      shellBootstrapQueryOptions(params.orgSlug),
    ),
  path: "/$orgSlug",
})

const orgIndexRoute = createRoute({
  getParentRoute: () => orgRoute,
  component: WorkspaceLandingPage,
  path: "/",
})

const usageRoute = createRoute({
  getParentRoute: () => orgRoute,
  component: WorkspaceUsagePage,
  loaderDeps: ({ search }) => ({
    search: {
      ...getDefaultUsageSearch(),
      ...search,
    },
  }),
  loader: ({ context, deps, params }) =>
    context.queryClient.ensureQueryData(
      usageOverviewQueryOptions(params.orgSlug, deps.search),
    ),
  path: "/usage",
  validateSearch: (search) => usageSearchSchema.parse(search),
})

const settingsRoute = createRoute({
  getParentRoute: () => orgRoute,
  component: WorkspaceSettingsPage,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      shellBootstrapQueryOptions(params.orgSlug),
    ),
  path: "/settings/workspace",
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  orgRoute.addChildren([orgIndexRoute, usageRoute, settingsRoute]),
])

const router = createRouter({
  basepath: "/app",
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  routeTree,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById("root")

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

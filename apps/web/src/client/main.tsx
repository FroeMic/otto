import {
  BuildingsIcon,
  GearIcon,
  HouseLineIcon,
  SignOutIcon,
  SparkleIcon,
} from "@phosphor-icons/react"
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
  useMatchRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { lazy, StrictMode, Suspense, useEffect, useId, useState } from "react"
import { createRoot } from "react-dom/client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import { shellBootstrapQueryOptions, updateWorkspaceSettings } from "./api"
import "./styles.css"

const queryClient = new QueryClient()
const LazyPlatformPage = lazy(() => import("./platform-page"))

function RootPage() {
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

type WorkspaceMenuLinkProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  params?: { orgSlug: string }
  to: "/$orgSlug" | "/$orgSlug/settings/workspace" | "/platform"
}

function WorkspaceMenuLink({
  icon: Icon,
  label,
  params,
  to,
}: WorkspaceMenuLinkProps) {
  const matchRoute = useMatchRoute()
  const isActive = Boolean(
    params
      ? matchRoute({ fuzzy: true, params, to })
      : matchRoute({ fuzzy: true, to }),
  )

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          params ? (
            <Link params={params} preload="intent" to={to} />
          ) : (
            <Link preload="intent" to={to} />
          )
        }
        isActive={isActive}
        tooltip={label}
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function WorkspaceLayout() {
  const { orgSlug } = workspaceRoute.useParams()
  const { data } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-4 border-b border-sidebar-border/70">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
              <SparkleIcon weight="fill" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium">Otto</p>
              <p className="truncate text-xs text-sidebar-foreground/70">
                {data.currentOrganization.name}
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <WorkspaceMenuLink
                  icon={HouseLineIcon}
                  label="Overview"
                  params={{ orgSlug }}
                  to="/$orgSlug"
                />
                <WorkspaceMenuLink
                  icon={GearIcon}
                  label="Settings"
                  params={{ orgSlug }}
                  to="/$orgSlug/settings/workspace"
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {data.organizations.map((organization) => (
                  <WorkspaceMenuLink
                    key={organization.id}
                    icon={BuildingsIcon}
                    label={organization.name}
                    params={{ orgSlug: organization.slug }}
                    to="/$orgSlug"
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {data.user.isPlatformAdmin ? (
            <SidebarGroup>
              <SidebarGroupLabel>Operator</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <WorkspaceMenuLink
                    icon={BuildingsIcon}
                    label="Platform"
                    to="/platform"
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border/70">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  window.location.assign("/auth/sign-out")
                }}
                tooltip="Sign out"
              >
                <SignOutIcon />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur md:px-6">
          <SidebarTrigger />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {data.currentOrganization.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              /{data.currentOrganization.slug}
            </p>
          </div>
        </header>

        <div className="flex flex-1 flex-col px-4 py-6 md:px-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function WorkspaceHomePage() {
  const { orgSlug } = workspaceRoute.useParams()
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

function WorkspaceSettingsLayout() {
  const { orgSlug } = workspaceRoute.useParams()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
          Settings
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Workspace settings
        </h1>
        <p className="text-sm text-muted-foreground">
          The first nested layout inside the workspace shell.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link params={{ orgSlug }} to="/$orgSlug/settings/workspace">
          {({ isActive }) => (
            <Button variant={isActive ? "default" : "outline"}>
              Workspace
            </Button>
          )}
        </Link>
      </div>

      <Outlet />
    </div>
  )
}

function WorkspaceSettingsIndexPage() {
  const navigate = useNavigate({ from: "/$orgSlug/settings/" })
  const { orgSlug } = workspaceRoute.useParams()

  useEffect(() => {
    void navigate({
      params: { orgSlug },
      replace: true,
      to: "/$orgSlug/settings/workspace",
    })
  }, [navigate, orgSlug])

  return <div className="text-sm text-muted-foreground">Loading settings…</div>
}

function WorkspaceSettingsPage() {
  const { orgSlug } = workspaceRoute.useParams()
  const { data } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: "/$orgSlug/settings/workspace" })
  const router = useRouter()
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
    onSuccess: async (result, variables) => {
      const nextOrgSlug =
        variables.action === "update-slug" && "slug" in result
          ? result.slug
          : orgSlug

      await queryClient.invalidateQueries({
        queryKey: ["shell-bootstrap", orgSlug],
      })
      await router.invalidate()

      if (nextOrgSlug !== orgSlug) {
        await navigate({
          params: { orgSlug: nextOrgSlug },
          replace: true,
          to: "/$orgSlug/settings/workspace",
        })
      }
    },
  })

  useEffect(() => {
    setName(data.currentOrganization.name)
    setSlug(data.currentOrganization.slug)
  }, [data.currentOrganization.name, data.currentOrganization.slug])

  return (
    <div className="grid gap-4">
      <form
        className="flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate({
            action: "update-name",
            value: name,
          })
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={nameFieldId}>
            Workspace name
          </label>
          <p className="text-sm text-muted-foreground">
            Displayed across the workspace shell and member-facing settings.
          </p>
        </div>
        <Input
          id={nameFieldId}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="flex justify-end">
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Saving…" : "Save name"}
          </Button>
        </div>
      </form>

      <form
        className="flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate({
            action: "update-slug",
            value: slug,
          })
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={slugFieldId}>
            Workspace URL slug
          </label>
          <p className="text-sm text-muted-foreground">
            This controls the browser-facing workspace route.
          </p>
        </div>
        <Input
          id={slugFieldId}
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
        <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          New URL: <span className="font-medium text-foreground">/{slug}</span>
        </div>
        <div className="flex justify-end">
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Saving…" : "Save URL"}
          </Button>
        </div>
      </form>

      <section className="rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm">
        <p className="text-sm font-medium">Regional defaults</p>
        <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div className="rounded-xl bg-muted px-4 py-3">
            Locale:{" "}
            <span className="font-medium text-foreground">
              {data.currentOrganization.locale}
            </span>
          </div>
          <div className="rounded-xl bg-muted px-4 py-3">
            Timezone:{" "}
            <span className="font-medium text-foreground">
              {data.currentOrganization.timezone}
            </span>
          </div>
          <div className="rounded-xl bg-muted px-4 py-3">
            Clock:{" "}
            <span className="font-medium text-foreground">
              {data.currentOrganization.timeFormatPreference}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}

function PlatformPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-muted-foreground">
          Loading platform…
        </div>
      }
    >
      <LazyPlatformPage />
    </Suspense>
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

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  component: WorkspaceLayout,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      shellBootstrapQueryOptions(params.orgSlug),
    ),
  path: "/$orgSlug",
})

const workspaceIndexRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  component: WorkspaceHomePage,
  path: "/",
})

const workspaceSettingsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  component: WorkspaceSettingsLayout,
  path: "/settings",
})

const workspaceSettingsIndexRoute = createRoute({
  getParentRoute: () => workspaceSettingsRoute,
  component: WorkspaceSettingsIndexPage,
  path: "/",
})

const workspaceSettingsWorkspaceRoute = createRoute({
  getParentRoute: () => workspaceSettingsRoute,
  component: WorkspaceSettingsPage,
  path: "/workspace",
})

const platformRoute = createRoute({
  getParentRoute: () => rootRoute,
  component: PlatformPage,
  path: "/platform",
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  workspaceRoute.addChildren([
    workspaceIndexRoute,
    workspaceSettingsRoute.addChildren([
      workspaceSettingsIndexRoute,
      workspaceSettingsWorkspaceRoute,
    ]),
  ]),
  platformRoute,
])

const router = createRouter({
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
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

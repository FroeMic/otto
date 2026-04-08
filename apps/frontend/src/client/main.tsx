import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { buttonVariants } from "../shared/button-variants"
import { cn } from "../shared/cn"
import "./styles.css"

const queryClient = new QueryClient()

function WorkspaceShell() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-8 px-6 py-8 md:px-10">
        <header className="flex items-center justify-between gap-4 rounded-[2rem] border border-border/70 bg-card px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/12" />
            <div>
              <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                Otto
              </p>
              <p className="text-sm text-muted-foreground">
                New workspace shell foundation
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className={cn(buttonVariants({ variant: "outline" }))}
              activeProps={{ className: cn(buttonVariants()) }}
            >
              Overview
            </Link>
            <Link
              to="/status"
              className={cn(buttonVariants({ variant: "outline" }))}
              activeProps={{ className: cn(buttonVariants()) }}
            >
              Status
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-border/70 bg-card px-5 py-6 shadow-sm">
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
              Workspace
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              App shell in progress
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              This placeholder SPA keeps the shell mounted while route content
              changes. The legacy workspace app still owns the real product
              routes today.
            </p>
          </aside>

          <div className="rounded-[2rem] border border-border/70 bg-card px-6 py-6 shadow-sm">
            <Outlet />
          </div>
        </section>
      </div>
    </main>
  )
}

function WorkspaceOverviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
        Overview
      </p>
      <h2 className="text-3xl font-semibold tracking-tight">
        Workspace SPA foundation
      </h2>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        The shell, route ownership, and TanStack Router baseline now live in the
        new frontend package. Real workspace routes will move here slice by
        slice later.
      </p>
    </div>
  )
}

function WorkspaceStatusPage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
        Status
      </p>
      <h2 className="text-3xl font-semibold tracking-tight">
        Migration status
      </h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
        <li>`apps/frontend` now owns the new browser-facing foundation.</li>
        <li>
          The landing routes can move here before the legacy workspace routes
          do.
        </li>
        <li>The shell stays mounted while route content changes.</li>
      </ul>
    </div>
  )
}

const rootRoute = createRootRoute({
  component: WorkspaceShell,
})

const indexRoute = createRoute({
  component: WorkspaceOverviewPage,
  getParentRoute: () => rootRoute,
  path: "/",
})

const statusRoute = createRoute({
  component: WorkspaceStatusPage,
  getParentRoute: () => rootRoute,
  path: "/status",
})

const routeTree = rootRoute.addChildren([indexRoute, statusRoute])

const router = createRouter({
  basepath: "/app",
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

import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { serveStatic } from "@hono/node-server/serve-static"
import { isReservedWorkspaceSlug } from "@otto/feature-workspace-slugs"
import { type Context, Hono } from "hono"
import { logger } from "hono/logger"
import { secureHeaders } from "hono/secure-headers"
import { renderToString } from "react-dom/server"

import { buttonVariants } from "../shared/button-variants"
import { cn } from "../shared/cn"
import type { FrontendEnv } from "./env"
import { getEnv } from "./env"
import {
  LandingHomePage,
  LandingPricingPage,
  LandingSecurityPage,
} from "./landing-pages"

type PageDocumentProps = {
  children: React.ReactNode
  description: string
  loadWorkspaceScript?: boolean
  path: string
  title: string
}

const STATIC_ROOT = fileURLToPath(new URL("../../dist/public", import.meta.url))
const WORKSPACE_STYLE_PATH = "/assets/workspace.css"
const WORKSPACE_SCRIPT_PATH = "/assets/workspace.js"
const WORKSPACE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

function PageDocument({
  children,
  description,
  loadWorkspaceScript = false,
  path,
  title,
}: PageDocumentProps) {
  const canonicalPath = path === "/" ? "" : path

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link
          rel="canonical"
          href={`https://getyourotto.com${canonicalPath}`}
        />
        <link rel="stylesheet" href={WORKSPACE_STYLE_PATH} />
      </head>
      <body>
        {children}
        {loadWorkspaceScript ? (
          <script type="module" src={WORKSPACE_SCRIPT_PATH} />
        ) : null}
      </body>
    </html>
  )
}

function renderDocument(props: PageDocumentProps) {
  return `<!DOCTYPE html>${renderToString(<PageDocument {...props} />)}`
}

function renderWorkspaceShell(path: string) {
  return renderDocument({
    children: (
      <>
        {/* biome-ignore lint/correctness/useUniqueElementIds: static SPA mount point */}
        <div id="root" />
      </>
    ),
    description: "Otto workspace migration shell",
    loadWorkspaceScript: true,
    path,
    title: "Otto Workspace",
  })
}

function renderNotFoundPage(path: string) {
  return renderDocument({
    children: (
      <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16 text-foreground">
        <div className="flex max-w-lg flex-col items-center gap-4 rounded-[2rem] border border-border/70 bg-card px-8 py-10 text-center shadow-sm">
          <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
            Otto
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Page not found
          </h1>
          <a href="/" className={cn(buttonVariants())}>
            Return home
          </a>
        </div>
      </main>
    ),
    description: "Otto page not found",
    path,
    title: "Otto",
  })
}

function isWorkspaceSlugCandidate(path: string) {
  const [firstSegment] = path.split("/").filter(Boolean)

  if (!firstSegment) {
    return false
  }

  if (isReservedWorkspaceSlug(firstSegment)) {
    return false
  }

  return WORKSPACE_SLUG_PATTERN.test(firstSegment)
}

function getLegacyAppRedirectPath(path: string) {
  if (path === "/app" || path === "/app/") {
    return "/login"
  }

  const nextPath = path.replace(/^\/app/, "")

  return nextPath.length > 0 ? nextPath : "/login"
}

function createProxyHandler(targetOrigin: string) {
  return async (context: Context) => {
    const upstreamUrl = new URL(context.req.url)
    const targetUrl = new URL(
      `${upstreamUrl.pathname}${upstreamUrl.search}`,
      targetOrigin,
    )
    const init: RequestInit & {
      duplex?: "half"
    } = {
      body:
        context.req.method === "GET" || context.req.method === "HEAD"
          ? undefined
          : context.req.raw.body,
      duplex: context.req.raw.body ? "half" : undefined,
      headers: context.req.raw.headers,
      method: context.req.method,
    }
    const response = await fetch(new Request(targetUrl, init))

    return new Response(response.body, {
      headers: response.headers,
      status: response.status,
    })
  }
}

function LoginPage({ returnTo }: { returnTo: string }) {
  return (
    <main className="min-h-svh bg-background px-6 py-16 text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-[2rem] border border-border/70 bg-card px-8 py-10 shadow-sm">
        <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
          Otto
        </p>
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            Sign in to your workspace
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            The new frontend now keeps authentication on the same origin. Sign
            in with WorkOS, then continue directly into the workspace shell.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
            className={cn(buttonVariants())}
          >
            Sign in
          </a>
          <a
            href={`/auth/sign-up?returnTo=${encodeURIComponent(returnTo)}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Create account
          </a>
        </div>
      </div>
    </main>
  )
}

export function createApp(env: FrontendEnv = getEnv()) {
  const app = new Hono()

  app.use("*", logger())
  app.use("*", secureHeaders())

  if (existsSync(STATIC_ROOT)) {
    app.use("/assets/*", serveStatic({ root: STATIC_ROOT }))
  }

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: "web",
    }),
  )

  const apiProxyHandler = createProxyHandler(env.API_ORIGIN)

  app.get("/login", (c) => {
    const returnTo = c.req.query("returnTo") ?? "/"

    return c.html(
      renderDocument({
        children: <LoginPage returnTo={returnTo} />,
        description: "Sign in to Otto",
        path: "/login",
        title: "Otto Sign In",
      }),
    )
  })
  app.get("/logout", (c) => c.redirect("/auth/sign-out", 302))
  app.all("/api/*", apiProxyHandler)

  app.get("/", (c) =>
    c.html(
      renderDocument({
        children: <LandingHomePage />,
        description:
          "Otto helps teams run real work from one workspace with a warm, product-first AI experience.",
        path: "/",
        title: "Otto",
      }),
    ),
  )

  app.get("/pricing", (c) =>
    c.html(
      renderDocument({
        children: <LandingPricingPage />,
        description: "Otto pricing",
        path: "/pricing",
        title: "Otto Pricing",
      }),
    ),
  )

  app.get("/security", (c) =>
    c.html(
      renderDocument({
        children: <LandingSecurityPage />,
        description: "Otto security",
        path: "/security",
        title: "Otto Security",
      }),
    ),
  )

  app.get("/app", (c) => c.redirect(getLegacyAppRedirectPath(c.req.path), 302))
  app.get("/app/*", (c) =>
    c.redirect(getLegacyAppRedirectPath(c.req.path), 302),
  )

  app.get("*", (c) => {
    const path = c.req.path

    if (path === "/platform" || path.startsWith("/platform/")) {
      return c.html(renderWorkspaceShell(path))
    }

    if (isWorkspaceSlugCandidate(path)) {
      return c.html(renderWorkspaceShell(path))
    }

    return c.html(renderNotFoundPage(path), 404)
  })

  app.notFound((c) => c.html(renderNotFoundPage(c.req.path), 404))

  return app
}

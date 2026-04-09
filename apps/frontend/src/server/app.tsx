import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { serveStatic } from "@hono/node-server/serve-static"
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

const STATIC_ROOT = fileURLToPath(
  new URL("../../dist/public/app", import.meta.url),
)
const STATIC_PARENT_ROOT = fileURLToPath(
  new URL("../../dist/public", import.meta.url),
)

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
        <link rel="stylesheet" href="/app/workspace.css" />
      </head>
      <body>
        {children}
        {loadWorkspaceScript ? (
          <script type="module" src="/app/workspace.js" />
        ) : null}
      </body>
    </html>
  )
}

function renderDocument(props: PageDocumentProps) {
  return `<!DOCTYPE html>${renderToString(<PageDocument {...props} />)}`
}

async function renderWorkspaceShell() {
  const markup = renderToString(
    <PageDocument
      description="Otto workspace migration shell"
      loadWorkspaceScript
      path="/app"
      title="Otto Workspace"
    >
      {/* biome-ignore lint/correctness/useUniqueElementIds: static SPA mount point */}
      <div id="root" />
    </PageDocument>,
  )

  return `<!DOCTYPE html>${markup}`
}

async function readWorkspaceIndex() {
  const indexPath = resolve(STATIC_ROOT, "index.html")

  try {
    return await readFile(indexPath, "utf8")
  } catch {
    return renderWorkspaceShell()
  }
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

  if (existsSync(STATIC_PARENT_ROOT)) {
    app.use("/app/*", serveStatic({ root: STATIC_PARENT_ROOT }))
  }

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: "frontend",
    }),
  )

  const apiProxyHandler = createProxyHandler(env.API_ORIGIN)

  app.get("/login", (c) => {
    const returnTo = c.req.query("returnTo") ?? "/app"

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

  app.get("/app", async (c) => c.html(await readWorkspaceIndex()))
  app.get("/app/*", async (c) => {
    const path = c.req.path

    if (
      path.startsWith("/app/assets/") ||
      path.endsWith(".css") ||
      path.endsWith(".js")
    ) {
      return c.notFound()
    }

    return c.html(await readWorkspaceIndex())
  })

  app.notFound((c) =>
    c.html(
      renderDocument({
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
        path: c.req.path,
        title: "Otto",
      }),
      404,
    ),
  )

  return app
}

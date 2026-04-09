import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import { logger } from "hono/logger"
import { proxy } from "hono/proxy"
import { secureHeaders } from "hono/secure-headers"
import { renderToString } from "react-dom/server"

import { buttonVariants } from "../shared/button-variants"
import { cn } from "../shared/cn"
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

export function createApp() {
  const env = getEnv()
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

  app.get("/login", (c) => c.redirect(`${env.WORKSPACE_APP_ORIGIN}/login`, 302))
  app.all("/api/*", (c) =>
    proxy(
      `${env.API_ORIGIN}${c.req.path}${c.req.url.includes("?") ? new URL(c.req.url).search : ""}`,
      {
        method: c.req.method,
        headers: c.req.raw.headers,
        body:
          c.req.method === "GET" || c.req.method === "HEAD"
            ? undefined
            : c.req.raw.body,
      },
    ),
  )

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

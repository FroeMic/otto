import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { serveStatic } from "@hono/node-server/serve-static"
import { isReservedWorkspaceSlug } from "@otto/feature-workspace-slugs"
import { type Context, Hono } from "hono"
import { logger } from "hono/logger"
import { secureHeaders } from "hono/secure-headers"
import { renderToString } from "react-dom/server"

import { OttoAvatar } from "../components/OttoAvatar"
import { buttonVariants } from "../shared/button-variants"
import { cn } from "../shared/cn"
import type { BrowserPostHogConfig } from "../shared/posthog"
import type { FrontendEnv } from "./env"
import { getEnv } from "./env"
import {
  LandingHomePage,
  LandingPricingPage,
  LandingSecurityPage,
} from "./landing"
import {
  getBrowserPostHogConfig,
  serializeBrowserPostHogConfig,
} from "./posthog"

type PageDocumentProps = {
  browserPostHogConfig?: BrowserPostHogConfig | null
  children: React.ReactNode
  description: string
  loadLandingScript?: boolean
  loadWorkspaceScript?: boolean
  path: string
  title: string
}

type LandingViewer = {
  email: string
  name: string
  workspaces: Array<{
    id: string
    isReady: boolean
    name: string
    slug: string
  }>
}

const STATIC_ROOT = fileURLToPath(new URL("../../dist/public", import.meta.url))
const BUILT_PUBLIC_ROOT = fileURLToPath(
  new URL("../../dist/public/assets", import.meta.url),
)
const SOURCE_PUBLIC_ROOT = fileURLToPath(
  new URL("../../public", import.meta.url),
)
const WORKSPACE_STYLE_PATH = "/assets/workspace.css"
const LANDING_SCRIPT_PATH = "/assets/landing.js"
const WORKSPACE_SCRIPT_PATH = "/assets/workspace.js"
const WORKSPACE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

function PageDocument({
  browserPostHogConfig = null,
  children,
  description,
  loadLandingScript = false,
  loadWorkspaceScript = false,
  path,
  title,
}: PageDocumentProps) {
  const canonicalPath = path === "/" ? "" : path
  const serializedPostHogConfig = serializeBrowserPostHogConfig(
    browserPostHogConfig,
  )

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
        {serializedPostHogConfig ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__OTTO_POSTHOG__ = ${serializedPostHogConfig};`,
            }}
          />
        ) : null}
        {loadLandingScript ? (
          <script type="module" src={LANDING_SCRIPT_PATH} />
        ) : null}
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

function renderWorkspaceShell(
  path: string,
  browserPostHogConfig: BrowserPostHogConfig | null,
) {
  return renderDocument({
    browserPostHogConfig,
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

function createExternalProxyHandler(options: {
  pathPrefix: string
  targetOrigin: string
}) {
  return async (context: Context) => {
    const upstreamUrl = new URL(context.req.url)
    const proxiedPath = upstreamUrl.pathname.startsWith(options.pathPrefix)
      ? upstreamUrl.pathname.slice(options.pathPrefix.length) || "/"
      : upstreamUrl.pathname
    const targetUrl = new URL(`${proxiedPath}${upstreamUrl.search}`, options.targetOrigin)
    const headers = new Headers(context.req.raw.headers)

    headers.delete("cookie")
    headers.delete("host")

    const init: RequestInit & {
      duplex?: "half"
    } = {
      body:
        context.req.method === "GET" || context.req.method === "HEAD"
          ? undefined
          : context.req.raw.body,
      duplex: context.req.raw.body ? "half" : undefined,
      headers,
      method: context.req.method,
    }
    const response = await fetch(new Request(targetUrl, init))

    return new Response(response.body, {
      headers: response.headers,
      status: response.status,
    })
  }
}

function parseLandingViewerWorkspaces(data: unknown): LandingViewer | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null
  }

  const record = data as Record<string, unknown>
  const user =
    record.user &&
    typeof record.user === "object" &&
    !Array.isArray(record.user)
      ? (record.user as Record<string, unknown>)
      : null
  const email = typeof user?.email === "string" ? user.email.trim() : ""
  const name = typeof user?.name === "string" ? user.name.trim() : ""

  if (!email || !name) {
    return null
  }

  const workspaces = Array.isArray(record.workspaces)
    ? record.workspaces.flatMap((workspace) => {
        if (
          !workspace ||
          typeof workspace !== "object" ||
          Array.isArray(workspace)
        ) {
          return []
        }

        const workspaceRecord = workspace as Record<string, unknown>
        const id =
          typeof workspaceRecord.id === "string"
            ? workspaceRecord.id.trim()
            : ""
        const workspaceName =
          typeof workspaceRecord.name === "string"
            ? workspaceRecord.name.trim()
            : ""
        const slug =
          typeof workspaceRecord.slug === "string"
            ? workspaceRecord.slug.trim()
            : ""

        if (!id || !workspaceName || !slug) {
          return []
        }

        return [
          {
            id,
            isReady: workspaceRecord.isReady === true,
            name: workspaceName,
            slug,
          },
        ]
      })
    : []

  return {
    email,
    name,
    workspaces,
  }
}

async function getLandingViewer(
  request: Request,
  env: FrontendEnv,
): Promise<LandingViewer | null> {
  const cookie = request.headers.get("cookie")

  if (!cookie) {
    return null
  }

  try {
    const response = await fetch(`${env.API_ORIGIN}/api/user/workspaces`, {
      headers: {
        Cookie: cookie,
      },
    })

    if (!response.ok) {
      return null
    }

    return parseLandingViewerWorkspaces(await response.json())
  } catch {
    return null
  }
}

function getPublicAssetPath(relativePath: string) {
  const normalizedPath = relativePath.replace(/^\/+/, "")
  const builtPath = `${STATIC_ROOT}/${normalizedPath}`

  if (existsSync(builtPath)) {
    return builtPath
  }

  const sourcePath = `${SOURCE_PUBLIC_ROOT}/${normalizedPath}`

  return existsSync(sourcePath) ? sourcePath : null
}

type LandingAuthMode = "sign-in" | "sign-up"

function LandingAuthModal({
  mode,
  prompt,
  returnTo,
}: {
  mode: LandingAuthMode
  prompt?: string
  returnTo: string
}) {
  const closeHref = prompt?.trim()
    ? `/?prompt=${encodeURIComponent(prompt)}#start`
    : "/"
  const isSignIn = mode === "sign-in"

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#1b2235]/62 px-6 py-12 backdrop-blur-[2px]"
      data-landing-auth-modal=""
      data-mode={mode}
    >
      <div className="relative flex w-full max-w-[25.5rem] flex-col gap-5 rounded-xl border border-black/8 bg-[#fcfbf8] px-7 py-7 text-foreground shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <a
          aria-label="Close"
          className="absolute right-5 top-5 text-[1.75rem] leading-none text-foreground/55 transition-colors hover:text-foreground"
          href={closeHref}
        >
          ×
        </a>

        <OttoAvatar className="size-11 rounded-md" />

        <div className="flex flex-col gap-1">
          <p className="text-[1rem] font-medium text-muted-foreground/85">
            {isSignIn ? "Welcome back." : "Start building."}
          </p>
          <h1 className="text-[2rem] font-semibold tracking-tight">
            {isSignIn ? "Log in to Otto" : "Create free account"}
          </h1>
        </div>

        {prompt ? (
          <div className="rounded-lg border border-border/70 bg-background px-4 py-4 text-left">
            <p className="overflow-hidden text-sm leading-6 text-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
              {prompt}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <a
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-border/75 bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-92"
            href={`/auth/${isSignIn ? "sign-in" : "sign-up"}?returnTo=${encodeURIComponent(returnTo)}`}
          >
            {isSignIn ? "Log in" : "Create account"}
          </a>
          <a
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-border/75 bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/45"
            href={`/login?mode=${isSignIn ? "sign-up" : "sign-in"}&returnTo=${encodeURIComponent(returnTo)}${prompt?.trim() ? `&prompt=${encodeURIComponent(prompt)}` : ""}`}
          >
            {isSignIn ? "Create account" : "Log in"}
          </a>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          By continuing, you agree to the Terms of Service and Privacy Policy.
        </p>

        <div className="border-t border-border/70 pt-4 text-xs text-muted-foreground">
          Your workspace is created automatically after sign-up, then Otto
          guides you through the initial setup.
        </div>
      </div>
    </div>
  )
}

export function createApp(env: FrontendEnv = getEnv()) {
  const app = new Hono()
  const browserPostHogConfig = getBrowserPostHogConfig(env)

  app.use("*", logger())
  app.use("*", secureHeaders())

  if (existsSync(STATIC_ROOT)) {
    app.use("/assets/*", serveStatic({ root: STATIC_ROOT }))
  }

  if (existsSync(BUILT_PUBLIC_ROOT)) {
    app.use("/integrations/*", serveStatic({ root: BUILT_PUBLIC_ROOT }))
  }

  if (existsSync(STATIC_ROOT)) {
    app.use("/integrations/*", serveStatic({ root: STATIC_ROOT }))
  }

  if (existsSync(SOURCE_PUBLIC_ROOT)) {
    app.use("/integrations/*", serveStatic({ root: SOURCE_PUBLIC_ROOT }))
  }

  if (getPublicAssetPath("otto-avatar.svg")) {
    app.get("/otto-avatar.svg", () => {
      const assetPath = getPublicAssetPath("otto-avatar.svg")

      if (!assetPath) {
        return new Response("Not found", { status: 404 })
      }

      return new Response(readFileSync(assetPath), {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
        },
      })
    })
  }

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: "web",
    }),
  )

  const apiProxyHandler = createProxyHandler(env.API_ORIGIN)
  const postHogAssetProxyHandler = createExternalProxyHandler({
    pathPrefix: "/ingest",
    targetOrigin: env.POSTHOG_ASSET_PROXY_TARGET,
  })
  const postHogProxyHandler = createExternalProxyHandler({
    pathPrefix: "/ingest",
    targetOrigin: env.POSTHOG_PROXY_TARGET,
  })

  app.all("/ingest/static/*", postHogAssetProxyHandler)
  app.all("/ingest/*", postHogProxyHandler)

  app.get("/login", async (c) => {
    const mode = c.req.query("mode") === "sign-in" ? "sign-in" : "sign-up"
    const prompt = c.req.query("prompt")?.trim()
    const returnTo = c.req.query("returnTo") ?? "/"
    const viewer = await getLandingViewer(c.req.raw, env)

    return c.html(
      renderDocument({
        browserPostHogConfig,
        children: (
          <LandingHomePage
            authModalSlot={
              <LandingAuthModal
                mode={mode}
                prompt={prompt}
                returnTo={returnTo}
              />
            }
            prompt={prompt}
            viewer={viewer}
          />
        ),
        description: "Sign in to Otto",
        loadLandingScript: true,
        path: "/login",
        title: "Otto Sign In",
      }),
    )
  })
  app.get("/logout", (c) => c.redirect("/auth/sign-out", 302))
  app.all("/api/*", apiProxyHandler)

  app.get("/", async (c) => {
    const viewer = await getLandingViewer(c.req.raw, env)

    return c.html(
      renderDocument({
        browserPostHogConfig,
        children: (
          <LandingHomePage
            prompt={c.req.query("prompt")?.trim()}
            viewer={viewer}
          />
        ),
        description:
          "Otto helps founders turn product momentum into a functioning software business.",
        loadLandingScript: true,
        path: "/",
        title: "Otto",
      }),
    )
  })

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

  app.get("*", (c) => {
    const path = c.req.path

    if (path === "/platform" || path.startsWith("/platform/")) {
      return c.html(renderWorkspaceShell(path, browserPostHogConfig))
    }

    if (isWorkspaceSlugCandidate(path)) {
      return c.html(renderWorkspaceShell(path, browserPostHogConfig))
    }

    return c.html(renderNotFoundPage(path), 404)
  })

  app.notFound((c) => c.html(renderNotFoundPage(c.req.path), 404))

  return app
}

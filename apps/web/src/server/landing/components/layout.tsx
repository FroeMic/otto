import { CaretUpDown } from "@phosphor-icons/react/ssr"
import type { PropsWithChildren, ReactNode } from "react"

import { OttoAvatar } from "@/components/OttoAvatar"
import { buttonVariants } from "@/shared/button-variants"
import { cn } from "@/shared/cn"

export interface LandingPageShellProps extends PropsWithChildren {
  footerPromptSlot?: ReactNode
  overlaySlot?: ReactNode
  viewer?: LandingHeaderViewer | null
}

export interface LandingHeaderViewer {
  email: string
  name: string
  workspaces: Array<{
    id: string
    isReady: boolean
    name: string
    slug: string
  }>
}

function OttoMark() {
  return (
    <span className="inline-flex items-center gap-3">
      <OttoAvatar className="size-8 rounded-md border border-border/70" />
      <span className="font-semibold tracking-tight text-foreground">Otto</span>
    </span>
  )
}

export interface LandingHeaderProps {
  viewer?: LandingHeaderViewer | null
}

export function LandingHeader({ viewer = null }: LandingHeaderProps) {
  const defaultWorkspace = viewer?.workspaces[0] ?? null

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/92 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-4 md:px-10 lg:px-12">
        <a href="/" className="inline-flex items-center">
          <OttoMark />
        </a>

        {viewer ? (
          <div className="flex items-center gap-2">
            <a
              aria-label={
                defaultWorkspace
                  ? `Open ${defaultWorkspace.name}`
                  : `Signed in as ${viewer.name}`
              }
              className="inline-flex h-9 items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-foreground/70"
              href={defaultWorkspace ? getWorkspaceHref(defaultWorkspace) : "/"}
              title={viewer.email}
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-[0.68rem] font-semibold text-background">
                {getViewerInitials(viewer)}
              </span>
              <span className="max-w-36 truncate">
                {defaultWorkspace?.name ?? viewer.name}
              </span>
            </a>
            <details className="group relative">
              <summary
                aria-label="Open workspace menu"
                className="flex h-9 cursor-pointer list-none items-center justify-center px-1 text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden"
              >
                <CaretUpDown aria-hidden="true" className="size-4" />
              </summary>
              <div className="absolute right-0 top-full isolate z-50 mt-3 flex w-72 flex-col overflow-hidden rounded-lg bg-popover/70 p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150 dark:ring-foreground/10">
                <div className="px-1 py-1.5 text-left text-sm">
                  <p className="truncate font-medium text-foreground">
                    {viewer.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {viewer.email}
                  </p>
                </div>
                <div className="-mx-1.5 my-1.5 h-px bg-border/50" />
                {viewer.workspaces.length > 0 ? (
                  <div className="flex flex-col">
                    <p className="px-3 py-2.5 text-xs text-muted-foreground">
                      Workspaces
                    </p>
                    {viewer.workspaces.map((workspace) => (
                      <a
                        className="relative flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-foreground outline-hidden transition-colors hover:bg-foreground/10"
                        href={getWorkspaceHref(workspace)}
                        key={workspace.id}
                      >
                        <span className="truncate">{workspace.name}</span>
                        {workspace.isReady ? null : (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            Setting up
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-2.5 text-sm text-muted-foreground">
                    No workspaces yet.
                  </p>
                )}
                <div className="-mx-1.5 my-1.5 h-px bg-border/50" />
                <a
                  className="relative rounded-2xl px-3 py-2 text-sm font-medium text-foreground outline-hidden transition-colors hover:bg-foreground/10"
                  href="/logout"
                >
                  Log out
                </a>
              </div>
            </details>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <a
              className={cn(
                buttonVariants({ size: "default", variant: "outline" }),
                "rounded-full border-border/75 bg-transparent px-4 shadow-none",
              )}
              href="/login?mode=sign-in"
            >
              Log in
            </a>
            <a
              className={cn(
                buttonVariants({ size: "default" }),
                "rounded-full bg-foreground px-4 text-background shadow-none hover:bg-foreground/92",
              )}
              href="/login"
            >
              Get started
            </a>
          </div>
        )}
      </div>
    </header>
  )
}

function getWorkspaceHref(
  workspace: LandingHeaderViewer["workspaces"][number],
) {
  return `/${workspace.slug}`
}

function getViewerInitials(viewer: LandingHeaderViewer) {
  const parts = viewer.name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return viewer.email.slice(0, 1).toUpperCase()
  }

  return parts
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("")
}

export function LandingSection({
  children,
  className,
  id,
}: PropsWithChildren<{
  className?: string
  id?: string
}>) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-7xl scroll-mt-28 px-6 md:px-10 lg:px-12",
        className,
      )}
      id={id}
    >
      {children}
    </section>
  )
}

export function LandingSectionEyebrow({ children }: PropsWithChildren) {
  return (
    <p className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
      {children}
    </p>
  )
}

export function LandingPageShell({
  children,
  footerPromptSlot,
  overlaySlot,
  viewer = null,
}: LandingPageShellProps) {
  return (
    <main className="relative min-h-svh bg-[#faf8f3] text-foreground">
      <LandingHeader viewer={viewer} />
      {children}
      <LandingFooter promptSlot={footerPromptSlot} />
      {overlaySlot}
    </main>
  )
}

export interface LandingFooterProps {
  promptSlot?: ReactNode
}

export function LandingFooter({ promptSlot }: LandingFooterProps) {
  return (
    <footer className="border-t border-border/65 pb-10 pt-10">
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 md:px-10 lg:px-12">
        {promptSlot ? (
          <div className="flex justify-center">{promptSlot}</div>
        ) : null}

        <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border/70 bg-background px-6 py-6 text-center shadow-[0_12px_36px_rgba(15,23,42,0.05)] sm:flex-row sm:text-left">
          <div className="flex flex-col gap-3">
            <a
              href="/"
              className="inline-flex items-center justify-center sm:justify-start"
            >
              <OttoMark />
            </a>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Otto gives founder-led software teams one operating layer for the
              business work around the product.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 sm:items-end">
            <p className="text-xs font-medium text-muted-foreground">
              Try for free with 1000 credits
            </p>
            <div className="flex items-center gap-3">
              <a
                className={cn(
                  buttonVariants({ size: "default", variant: "outline" }),
                  "rounded-full border-border/75 bg-transparent px-4 shadow-none",
                )}
                href="/login?mode=sign-in"
              >
                Log in
              </a>
              <a
                className={cn(
                  buttonVariants({ size: "default" }),
                  "rounded-full bg-foreground px-4 text-background shadow-none hover:bg-foreground/92",
                )}
                href="/login"
              >
                Try for free
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

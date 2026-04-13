import type { PropsWithChildren, ReactNode } from "react"

import { buttonVariants } from "@/shared/button-variants"
import { cn } from "@/shared/cn"

import { landingFooterColumns, landingPrimaryNavigation } from "../content/home"

export interface LandingPageShellProps extends PropsWithChildren {
  footerPromptSlot?: ReactNode
}

function OttoMark() {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="size-4 rounded-full bg-[radial-gradient(circle_at_30%_30%,#8ba7ff_0%,#6f7df4_42%,#ff875f_100%)]" />
      <span className="font-semibold tracking-tight text-foreground">Otto</span>
    </span>
  )
}

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/92 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-4 md:px-10 lg:px-12">
        <a href="/" className="inline-flex items-center">
          <OttoMark />
        </a>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {landingPrimaryNavigation.map((item) => (
            <a
              className="transition-colors hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            className={cn(
              buttonVariants({ size: "default", variant: "outline" }),
              "rounded-full border-border/75 bg-transparent px-4 shadow-none",
            )}
            href="/login"
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
      </div>
    </header>
  )
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
}: LandingPageShellProps) {
  return (
    <main className="min-h-svh bg-[#faf8f3] text-foreground">
      <LandingHeader />
      {children}
      <LandingFooter promptSlot={footerPromptSlot} />
    </main>
  )
}

export interface LandingFooterProps {
  promptSlot?: ReactNode
}

export function LandingFooter({ promptSlot }: LandingFooterProps) {
  return (
    <footer className="border-t border-border/65 pb-16 pt-24">
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 md:px-10 lg:px-12">
        {promptSlot ? (
          <div className="flex justify-center">{promptSlot}</div>
        ) : null}

        <div className="rounded-xl border border-border/70 bg-background px-8 py-10 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
          <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
            <div className="flex flex-col gap-4">
              <a href="/" className="inline-flex items-center">
                <OttoMark />
              </a>
              <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                Otto helps founders turn product momentum into a functioning
                software business.
              </p>
            </div>

            {landingFooterColumns.map((column) => (
              <div className="flex flex-col gap-4" key={column.title}>
                <h2 className="text-sm font-medium text-foreground">
                  {column.title}
                </h2>
                <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                  {column.links.map((link) => (
                    <li key={link.href + link.label}>
                      <a
                        className="transition-colors hover:text-foreground"
                        href={link.href}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

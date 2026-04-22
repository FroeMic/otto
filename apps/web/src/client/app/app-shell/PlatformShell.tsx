import { useSuspenseQuery } from "@tanstack/react-query"
import { useLocation } from "@tanstack/react-router"
import type { PropsWithChildren } from "react"

import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { platformBootstrapQueryOptions } from "@/features/platform/api/platform"

import { PlatformSidebar } from "./PlatformSidebar"
import { ShellStage } from "./ShellStage"
import { ShellViewport } from "./ShellViewport"

export interface PlatformShellProps extends PropsWithChildren {}

function usePlatformPageLabel(
  platformOrganizations: Array<{
    name: string
    slug: string
  }>,
) {
  const location = useLocation()
  const pathname = location.pathname

  if (pathname === "/platform" || pathname === "/platform/organizations") {
    return "Organizations"
  }

  if (pathname.startsWith("/platform/organizations/")) {
    const [, , , orgSlug] = pathname.split("/")
    const organization = platformOrganizations.find(
      (candidate) => candidate.slug === orgSlug,
    )

    return organization?.name ?? orgSlug ?? "Organizations"
  }

  return "Platform"
}

export function PlatformShell({ children }: PlatformShellProps) {
  const { data } = useSuspenseQuery(platformBootstrapQueryOptions())
  const pageLabel = usePlatformPageLabel(data.organizations)

  return (
    <ShellViewport>
      <ShellStage>
        <SidebarProvider className="h-full min-h-0">
          <PlatformSidebar />
          <SidebarInset className="min-h-0 overflow-hidden">
            <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:px-6">
              <SidebarTrigger />
              <Separator
                orientation="vertical"
                className="data-vertical:h-4 data-vertical:self-auto"
              />
              <div className="min-w-0 text-sm">
                <span className="font-medium">Platform Administration</span>
                <span className="mx-2 text-muted-foreground">/</span>
                <span className="truncate text-muted-foreground">
                  {pageLabel}
                </span>
              </div>
            </header>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ShellStage>
    </ShellViewport>
  )
}

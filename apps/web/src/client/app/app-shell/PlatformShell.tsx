import { useSuspenseQuery } from "@tanstack/react-query"
import { useLocation } from "@tanstack/react-router"
import type { PropsWithChildren } from "react"

import { PlatformSidebar } from "@/client/app/app-shell/PlatformSidebar"
import { platformBootstrapQueryOptions } from "@/features/platform/api/platform"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export interface PlatformShellProps extends PropsWithChildren {}

function usePlatformPageLabel(platformOrganizations: Array<{
  name: string
  slug: string
}>) {
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
    <SidebarProvider>
      <PlatformSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
          <SidebarTrigger />
          <Separator
            orientation="vertical"
            className="data-vertical:h-4 data-vertical:self-auto"
          />
          <div className="min-w-0 text-sm">
            <span className="font-medium">Platform Administration</span>
            <span className="mx-2 text-muted-foreground">/</span>
            <span className="truncate text-muted-foreground">{pageLabel}</span>
          </div>
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

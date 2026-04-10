import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useLocation } from "@tanstack/react-router"
import type { PropsWithChildren } from "react"

import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"

import { SettingsSidebar } from "./SettingsSidebar"

interface BreadcrumbSegment {
  href: string | null
  label: string
}

export interface SettingsShellProps extends PropsWithChildren {
  orgSlug: string
}

function useSettingsBreadcrumbs(
  orgSlug: string,
  orgName: string,
): BreadcrumbSegment[] {
  const location = useLocation()
  const settingsPath = location.pathname.replace(`/${orgSlug}/settings`, "")
  const base = `/${orgSlug}/settings`

  if (settingsPath.startsWith("/user")) {
    return [{ href: `${base}/user`, label: "Account" }]
  }

  if (settingsPath.startsWith("/workspace/usage")) {
    return [
      { href: `${base}/workspace`, label: orgName },
      { href: null, label: "Usage" },
    ]
  }

  if (settingsPath.startsWith("/workspace/billing/plans")) {
    return [
      { href: `${base}/workspace`, label: orgName },
      { href: `${base}/workspace/billing`, label: "Billing" },
      { href: null, label: "Plans" },
    ]
  }

  if (settingsPath.startsWith("/workspace/billing")) {
    return [
      { href: `${base}/workspace`, label: orgName },
      { href: null, label: "Billing" },
    ]
  }

  if (settingsPath.startsWith("/workspace/members")) {
    return [
      { href: `${base}/workspace`, label: orgName },
      { href: null, label: "Members" },
    ]
  }

  if (settingsPath.startsWith("/workspace")) {
    return [
      { href: `${base}/workspace`, label: orgName },
      { href: null, label: "General" },
    ]
  }

  return [{ href: null, label: "Settings" }]
}

export function SettingsShell({ children, orgSlug }: SettingsShellProps) {
  const { data: shellData } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))
  const breadcrumbs = useSettingsBreadcrumbs(
    shellData.currentOrganization.slug,
    shellData.currentOrganization.name,
  )

  return (
    <SidebarProvider>
      <SettingsSidebar
        currentOrganization={{
          name: shellData.currentOrganization.name,
          slug: shellData.currentOrganization.slug,
        }}
        organizations={shellData.organizations.map((organization) => ({
          name: organization.name,
          slug: organization.slug,
        }))}
        user={shellData.user}
      />
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
          <SidebarTrigger />
          <Separator
            orientation="vertical"
            className="data-vertical:h-4 data-vertical:self-auto"
          />
          <div className="min-w-0 text-sm">
            <Link
              className="font-medium hover:underline"
              params={{ orgSlug: shellData.currentOrganization.slug }}
              to="/$orgSlug/settings/workspace"
            >
              Settings
            </Link>
            {breadcrumbs.map((segment) => (
              <span key={segment.label}>
                <span className="mx-2 text-muted-foreground">/</span>
                {segment.href ? (
                  <a
                    className="truncate text-muted-foreground hover:text-foreground hover:underline"
                    href={segment.href}
                  >
                    {segment.label}
                  </a>
                ) : (
                  <span className="truncate text-muted-foreground">
                    {segment.label}
                  </span>
                )}
              </span>
            ))}
          </div>
        </header>
        <div className="flex flex-1 flex-col px-4 py-6 md:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

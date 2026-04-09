"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";

import { SettingsSidebar } from "./settings-sidebar";
import { Separator } from "../../../../components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../../../../components/ui/sidebar";

type SettingsShellProps = {
  children: React.ReactNode;
  currentOrganization: {
    name: string;
    slug: string;
  };
  organizations: Array<{
    name: string;
    slug: string;
  }>;
  user: {
    email: string;
    id: string;
    name: string;
  };
};

type BreadcrumbSegment = {
  href: string | null;
  label: string;
};

function useSettingsBreadcrumbs(
  orgSlug: string,
  orgName: string,
): BreadcrumbSegment[] {
  const pathname = usePathname();
  const settingsPath = pathname.replace(`/${orgSlug}/settings`, "");
  const base = `/${orgSlug}/settings`;

  if (settingsPath.startsWith("/user"))
    return [{ href: `${base}/user`, label: "Account" }];

  if (settingsPath.startsWith("/workspace/usage"))
    return [
      { href: `${base}/workspace`, label: orgName },
      { href: null, label: "Usage" },
    ];

  if (settingsPath.startsWith("/workspace/billing/plans"))
    return [
      { href: `${base}/workspace`, label: orgName },
      { href: `${base}/workspace/billing`, label: "Billing" },
      { href: null, label: "Plans" },
    ];

  if (settingsPath.startsWith("/workspace/billing"))
    return [
      { href: `${base}/workspace`, label: orgName },
      { href: null, label: "Billing" },
    ];

  if (settingsPath.startsWith("/workspace/members"))
    return [
      { href: `${base}/workspace`, label: orgName },
      { href: null, label: "Members" },
    ];

  if (settingsPath.startsWith("/workspace"))
    return [
      { href: `${base}/workspace`, label: orgName },
      { href: null, label: "General" },
    ];

  return [{ href: null, label: "Settings" }];
}

export function SettingsShell({
  children,
  currentOrganization,
  organizations,
  user,
}: SettingsShellProps) {
  const breadcrumbs = useSettingsBreadcrumbs(
    currentOrganization.slug,
    currentOrganization.name,
  );

  return (
    <SidebarProvider>
      <SettingsSidebar
        currentOrganization={currentOrganization}
        organizations={organizations}
        user={user}
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
              href={`/${currentOrganization.slug}/settings/workspace`}
            >
              Settings
            </Link>
            {breadcrumbs.map((segment) => (
              <span key={segment.label}>
                <span className="mx-2 text-muted-foreground">/</span>
                {segment.href ? (
                  <Link
                    className="truncate text-muted-foreground hover:text-foreground hover:underline"
                    href={segment.href}
                  >
                    {segment.label}
                  </Link>
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
  );
}

"use client";

import { usePathname } from "next/navigation";
import type * as React from "react";

import { PlatformSidebar } from "./platform-sidebar";
import { PostHogUserIdentity } from "../../../components/posthog-user-identity";
import { Separator } from "../../../components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../../../components/ui/sidebar";

type PlatformShellProps = {
  children: React.ReactNode;
  organizations: Array<{
    name: string;
    slug: string;
  }>;
  platformOrganizations: Array<{
    name: string;
    slug: string;
  }>;
  user: {
    email: string;
    id: string;
    name: string;
  };
};

function usePlatformPageLabel(
  platformOrganizations: Array<{
    name: string;
    slug: string;
  }>,
) {
  const pathname = usePathname();

  if (pathname === "/platform" || pathname === "/platform/organizations") {
    return "Organizations";
  }

  if (pathname.startsWith("/platform/organizations/")) {
    const [, , , orgSlug] = pathname.split("/");
    const organization = platformOrganizations.find(
      (candidate) => candidate.slug === orgSlug,
    );

    return organization?.name ?? orgSlug ?? "Organizations";
  }

  return "Platform";
}

export function PlatformShell({
  children,
  organizations,
  platformOrganizations,
  user,
}: PlatformShellProps) {
  const pageLabel = usePlatformPageLabel(platformOrganizations);

  return (
    <SidebarProvider>
      <PostHogUserIdentity user={user} />
      <PlatformSidebar organizations={organizations} user={user} />
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
  );
}

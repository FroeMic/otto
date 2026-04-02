"use client";

import { usePathname } from "next/navigation";
import type * as React from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { WorkspaceStatusRail } from "@/components/workspace-status-rail";
import type { DashboardOrganization } from "@/db/control-plane";
import { isOrganizationUnlocked } from "@/lib/workspace";

const routeTitles: Record<string, string> = {
  agent: "Agent",
  integrations: "Integrations",
  tools: "Tools",
  skills: "Skills",
  "scheduled-tasks": "Scheduled Tasks",
  settings: "Settings",
};

function getPageTitle(pathname: string, orgSlug: string) {
  const prefix = `/${orgSlug}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  const segment = rest.split("/")[0];
  return segment ? (routeTitles[segment] ?? null) : null;
}

type OrganizationShellProps = {
  children: React.ReactNode;
  currentOrganization: DashboardOrganization;
  organizations: Array<{
    name: string;
    slug: string;
  }>;
  user: {
    email: string;
    isPlatformAdmin: boolean;
    name: string;
  };
};

export function OrganizationShell({
  children,
  currentOrganization,
  organizations,
  user,
}: OrganizationShellProps) {
  const pathname = usePathname();
  const onboardingPath = `/${currentOrganization.slug}/onboarding`;
  const slackSetupPath = `/${currentOrganization.slug}/integrations/slack`;
  const integrationsPath = `/${currentOrganization.slug}/integrations`;
  const isSetupFlow =
    !isOrganizationUnlocked(currentOrganization) &&
    (pathname === onboardingPath ||
      pathname.startsWith(`${onboardingPath}/`) ||
      pathname === slackSetupPath);
  const toolsPath = `/${currentOrganization.slug}/tools`;

  const pageTitle = getPageTitle(pathname, currentOrganization.slug);

  const showWorkspaceStatusRail =
    pathname !== slackSetupPath &&
    pathname !== integrationsPath &&
    pathname !== toolsPath;

  if (isSetupFlow) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10">
          <div className="w-full">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar
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
          <span className="text-sm font-medium">
            {pageTitle ?? currentOrganization.name}
          </span>
        </header>
        <div className="flex flex-1 flex-col px-4 py-6 md:px-6">{children}</div>
        {showWorkspaceStatusRail ? (
          <WorkspaceStatusRail organization={currentOrganization} />
        ) : null}
      </SidebarInset>
    </SidebarProvider>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  BreadcrumbProvider,
  useBreadcrumbSegments,
} from "@/components/breadcrumb-context";
import { PostHogUserIdentity } from "@/components/posthog-user-identity";
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
  capabilities: "Capabilities",
  integrations: "Integrations",
  tools: "Tools",
  skills: "Skills",
  sessions: "Sessions",
  "scheduled-tasks": "Scheduled Tasks",
  settings: "Settings",
};

type PageHeader = {
  title: string;
  parentTitle?: string;
  parentHref?: string;
};

function getPageHeader(pathname: string, orgSlug: string): PageHeader | null {
  const prefix = `/${orgSlug}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  const segments = rest.split("/").filter(Boolean);
  const firstSegment = segments[0];
  if (!firstSegment) return null;

  const title = routeTitles[firstSegment] ?? null;
  if (!title) return null;

  // Sub-page breadcrumbs for sessions and scheduled tasks
  if (
    segments.length > 1 &&
    (firstSegment === "sessions" || firstSegment === "scheduled-tasks")
  ) {
    return {
      title,
      parentTitle: title,
      parentHref: `/${orgSlug}/${firstSegment}`,
    };
  }

  return { title };
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
    id: string;
    isPlatformAdmin: boolean;
    name: string;
  };
};

function ShellHeader({
  pageHeader,
  fallbackTitle,
}: {
  pageHeader: PageHeader | null;
  fallbackTitle: string;
}) {
  const breadcrumbSegments = useBreadcrumbSegments();

  return (
    <header className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
      <SidebarTrigger />
      <Separator
        orientation="vertical"
        className="data-vertical:h-4 data-vertical:self-auto"
      />
      {breadcrumbSegments.length > 0 ? (
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          {breadcrumbSegments.map((segment, i) => (
            <span
              key={breadcrumbSegments
                .slice(0, i + 1)
                .map(({ href, label }) => `${href ?? "current"}:${label}`)
                .join("/")}
              className="flex items-center gap-1.5 min-w-0"
            >
              {i > 0 && (
                <span className="text-muted-foreground shrink-0">/</span>
              )}
              {segment.href ? (
                <Link
                  href={segment.href}
                  className="font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  {segment.label}
                </Link>
              ) : (
                <span className="font-medium truncate">{segment.label}</span>
              )}
            </span>
          ))}
        </div>
      ) : pageHeader?.parentHref ? (
        <Link
          href={pageHeader.parentHref}
          className="text-sm font-medium hover:text-foreground/80 transition-colors"
        >
          {pageHeader.parentTitle}
        </Link>
      ) : (
        <span className="text-sm font-medium">
          {pageHeader?.title ?? fallbackTitle}
        </span>
      )}
    </header>
  );
}

export function OrganizationShell({
  children,
  currentOrganization,
  organizations,
  user,
}: OrganizationShellProps) {
  const pathname = usePathname();
  const onboardingPath = `/${currentOrganization.slug}/onboarding`;
  const slackSetupPath = `/${currentOrganization.slug}/integrations/slack`;
  const isSetupFlow =
    !isOrganizationUnlocked(currentOrganization) &&
    (pathname === onboardingPath ||
      pathname.startsWith(`${onboardingPath}/`) ||
      pathname === slackSetupPath);

  const pageHeader = getPageHeader(pathname, currentOrganization.slug);

  if (isSetupFlow) {
    return (
      <>
        <PostHogUserIdentity user={user} />
        <div className="min-h-screen bg-background">
          <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10">
            <div className="w-full">{children}</div>
          </main>
        </div>
      </>
    );
  }

  return (
    <BreadcrumbProvider>
      <PostHogUserIdentity user={user} />
      <SidebarProvider>
        <AppSidebar
          currentOrganization={currentOrganization}
          organizations={organizations}
          user={user}
        />
        <SidebarInset>
          <ShellHeader
            pageHeader={pageHeader}
            fallbackTitle={currentOrganization.name}
          />
          <div className="flex min-h-0 flex-1 flex-col px-4 py-6 md:px-6">
            {children}
          </div>
          <WorkspaceStatusRail organization={currentOrganization} />
        </SidebarInset>
      </SidebarProvider>
    </BreadcrumbProvider>
  );
}

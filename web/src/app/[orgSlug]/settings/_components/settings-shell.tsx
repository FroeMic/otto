"use client";

import { usePathname } from "next/navigation";
import type * as React from "react";

import { SettingsSidebar } from "@/app/[orgSlug]/settings/_components/settings-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type SettingsShellProps = {
  children: React.ReactNode;
  currentOrganization: {
    name: string;
    slug: string;
  };
  user: {
    email: string;
    id: string;
    name: string;
  };
};

function useSettingsBreadcrumb(orgSlug: string, orgName: string) {
  const pathname = usePathname();
  const settingsPath = pathname.replace(`/${orgSlug}/settings`, "");

  if (settingsPath.startsWith("/user")) return ["Account"];
  if (settingsPath.startsWith("/workspace/members"))
    return [orgName, "Members"];
  if (settingsPath.startsWith("/workspace")) return [orgName, "General"];

  return ["Settings"];
}

export function SettingsShell({
  children,
  currentOrganization,
  user,
}: SettingsShellProps) {
  const breadcrumb = useSettingsBreadcrumb(
    currentOrganization.slug,
    currentOrganization.name,
  );

  return (
    <SidebarProvider>
      <SettingsSidebar currentOrganization={currentOrganization} user={user} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
          <SidebarTrigger />
          <Separator
            orientation="vertical"
            className="data-vertical:h-4 data-vertical:self-auto"
          />
          <div className="min-w-0 text-sm">
            <span className="font-medium">Settings</span>
            {breadcrumb.map((segment, i) => (
              <span key={breadcrumb.slice(0, i + 1).join("/")}>
                <span className="mx-2 text-muted-foreground">/</span>
                <span className="truncate text-muted-foreground">
                  {segment}
                </span>
              </span>
            ))}
          </div>
        </header>
        <div className="flex flex-1 flex-col px-4 py-6 md:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

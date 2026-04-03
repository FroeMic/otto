"use client";

import type * as React from "react";
import { usePathname } from "next/navigation";

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
    name: string;
  };
};

function useSettingsPageLabel(orgSlug: string) {
  const pathname = usePathname();
  const settingsPath = pathname.replace(`/${orgSlug}/settings`, "");

  if (settingsPath.startsWith("/user")) return "Account";
  if (settingsPath.startsWith("/workspace/members")) return "Members";
  if (settingsPath.startsWith("/workspace")) return "General";

  return "Settings";
}

export function SettingsShell({
  children,
  currentOrganization,
  user,
}: SettingsShellProps) {
  const pageLabel = useSettingsPageLabel(currentOrganization.slug);

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
            <span className="mx-2 text-muted-foreground">/</span>
            <span className="truncate text-muted-foreground">
              {pageLabel}
            </span>
          </div>
        </header>
        <div className="flex flex-1 flex-col px-4 py-6 md:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

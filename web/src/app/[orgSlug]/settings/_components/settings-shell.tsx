"use client";

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
    name: string;
  };
};

export function SettingsShell({
  children,
  currentOrganization,
  user,
}: SettingsShellProps) {
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
          <div className="flex flex-col">
            <span className="text-sm font-medium">Settings</span>
            <span className="text-xs text-muted-foreground">
              {currentOrganization.name}
            </span>
          </div>
        </header>
        <div className="flex flex-1 flex-col px-4 py-6 md:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

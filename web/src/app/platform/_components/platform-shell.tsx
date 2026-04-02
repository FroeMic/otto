"use client";

import type * as React from "react";

import { PlatformSidebar } from "@/app/platform/_components/platform-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type PlatformShellProps = {
  children: React.ReactNode;
  organizations: Array<{
    name: string;
    slug: string;
  }>;
  user: {
    email: string;
    name: string;
  };
};

export function PlatformShell({
  children,
  organizations,
  user,
}: PlatformShellProps) {
  return (
    <SidebarProvider>
      <PlatformSidebar organizations={organizations} user={user} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
          <SidebarTrigger />
          <Separator
            orientation="vertical"
            className="data-vertical:h-4 data-vertical:self-auto"
          />
          <span className="text-sm font-medium">Platform Administration</span>
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

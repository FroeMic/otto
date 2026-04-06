"use client";

import {
  ArrowSquareLeft,
  CaretUpDown,
  SignOut,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { usePlatformSourceWorkspaceSlug } from "@/app/platform/_lib/source-workspace";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { resetPostHogBrowserAnalytics } from "@/lib/posthog/browser";

type PlatformUserMenuProps = {
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

export function PlatformUserMenu({
  organizations,
  user,
}: PlatformUserMenuProps) {
  const { isMobile } = useSidebar();
  const sourceWorkspaceSlug = usePlatformSourceWorkspaceSlug(organizations);
  const fallback = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0])
    .join("")
    .toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarFallback>{fallback || "OT"}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <CaretUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarFallback>{fallback || "OT"}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {sourceWorkspaceSlug ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    render={<Link href={`/${sourceWorkspaceSlug}`} />}
                  >
                    <ArrowSquareLeft />
                    Open workspace
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                resetPostHogBrowserAnalytics();
                window.location.assign("/auth/sign-out");
              }}
            >
              <SignOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

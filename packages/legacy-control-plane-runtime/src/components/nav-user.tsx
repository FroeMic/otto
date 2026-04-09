"use client";

import { CaretUpDown, Gear, SignOut, User } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar";
import { resetPostHogBrowserAnalytics } from "../lib/posthog/browser";

export function NavUser({
  currentOrganizationSlug,
  user,
}: {
  currentOrganizationSlug: string;
  user: {
    email: string;
    id: string;
    name: string;
  };
}) {
  const { isMobile } = useSidebar();
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
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
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
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={
                  <Link href={`/${currentOrganizationSlug}/settings/user`} />
                }
              >
                <User />
                User settings
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href={`/${currentOrganizationSlug}/settings/workspace`}
                  />
                }
              >
                <Gear />
                Workspace settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
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

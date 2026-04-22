"use client"

import {
  BuildingsIcon,
  CaretUpDownIcon,
  GearIcon,
  SignOutIcon,
  UserIcon,
} from "@phosphor-icons/react"
import { Link, useMatchRoute } from "@tanstack/react-router"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface WorkspaceUserMenuProps {
  currentOrganizationSlug: string
  user: {
    email: string
    id: string
    isPlatformAdmin: boolean
    name: string
  }
}

export function WorkspaceUserMenu({
  currentOrganizationSlug,
  user,
}: WorkspaceUserMenuProps) {
  const fallback = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0])
    .join("")
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="px-2.5 aria-expanded:bg-muted"
              />
            }
          >
            <Avatar>
              <AvatarFallback>{fallback || "OT"}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <CaretUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56 rounded-lg" align="end">
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

              <DropdownMenuItem
                render={
                  <Link
                    params={{ orgSlug: currentOrganizationSlug }}
                    preload="intent"
                    to="/$orgSlug/settings/user"
                  />
                }
              >
                <UserIcon />
                <span>User settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    params={{ orgSlug: currentOrganizationSlug }}
                    preload="intent"
                    to="/$orgSlug/settings/workspace"
                  />
                }
              >
                <GearIcon />
                <span>Workspace settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <a href="/auth/sign-out">
                  <span className="sr-only">Sign out</span>
                </a>
              }
            >
              <SignOutIcon />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export interface WorkspaceFooterPlatformLinkProps {
  orgSlug: string
}

export function WorkspaceFooterPlatformLink({
  orgSlug,
}: WorkspaceFooterPlatformLinkProps) {
  const matchRoute = useMatchRoute()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={
            <Link
              preload="intent"
              search={() => ({
                workspace: orgSlug,
              })}
              to="/platform/organizations"
            />
          }
          isActive={Boolean(matchRoute({ fuzzy: true, to: "/platform" }))}
          tooltip="Platform"
          className="px-2.5"
        >
          <BuildingsIcon />
          <span>Platform</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

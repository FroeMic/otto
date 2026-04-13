import {
  BuildingOffice,
  CaretUpDown,
  Gear,
} from "@phosphor-icons/react/ssr"
import { Link } from "@tanstack/react-router"
import type { ComponentProps } from "react"

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
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

export interface WorkspaceSwitcherOrganization {
  name: string
  slug: string
}

export interface WorkspaceSwitcherProps
  extends ComponentProps<typeof SidebarMenu> {
  currentOrganization: WorkspaceSwitcherOrganization
  organizations: WorkspaceSwitcherOrganization[]
}

export function WorkspaceSwitcher({
  currentOrganization,
  organizations,
  ...props
}: WorkspaceSwitcherProps) {
  const fallback = currentOrganization.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0])
    .join("")
    .toUpperCase()

  return (
    <SidebarMenu {...props}>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="h-11 rounded-2xl px-2 aria-expanded:bg-muted"
              />
            }
          >
            <Avatar className="size-9">
              <AvatarFallback>{fallback || "OT"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">
                {currentOrganization.name}
              </span>
            </div>
            <CaretUpDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-56 rounded-lg"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarFallback>{fallback || "OT"}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {currentOrganization.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {currentOrganization.slug}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {organizations.map((organization) => (
                <DropdownMenuItem
                  key={organization.slug}
                  render={
                    <Link params={{ orgSlug: organization.slug }} to="/$orgSlug" />
                  }
                >
                  <BuildingOffice />
                  {organization.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link
                  params={{ orgSlug: currentOrganization.slug }}
                  to="/$orgSlug/settings/workspace"
                />
              }
            >
              <Gear />
              Workspace settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

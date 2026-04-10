import {
  BuildingOffice,
  CaretUpDown,
  Gear,
} from "@phosphor-icons/react/ssr"
import { Link } from "@tanstack/react-router"
import type { ComponentProps } from "react"

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
  return (
    <SidebarMenu {...props}>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <div className="flex size-8 items-center justify-center border bg-background">
              <BuildingOffice />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {currentOrganization.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {currentOrganization.slug}
              </span>
            </div>
            <CaretUpDown className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-64">
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

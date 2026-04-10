"use client"

import type { Icon } from "@phosphor-icons/react"
import { Link, useMatchRoute } from "@tanstack/react-router"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

type NavItem = {
  icon: Icon
  items?: Array<{
    label: string
    to: "/$orgSlug" | "/$orgSlug/settings/workspace"
  }>
  label: string
  to: "/$orgSlug" | "/$orgSlug/settings/workspace"
}

export function NavMain({
  items,
  orgSlug,
}: {
  items: NavItem[]
  orgSlug: string
}) {
  const matchRoute = useMatchRoute()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Workspace</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = Boolean(
              matchRoute({
                fuzzy: true,
                params: { orgSlug },
                to: item.to,
              }),
            )

            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  render={
                    <Link params={{ orgSlug }} preload="intent" to={item.to} />
                  }
                  isActive={isActive}
                  tooltip={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <SidebarMenuSub>
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.label}>
                        <SidebarMenuSubButton
                          render={
                            <Link
                              params={{ orgSlug }}
                              preload="intent"
                              to={subItem.to}
                            />
                          }
                          isActive={Boolean(
                            matchRoute({
                              fuzzy: true,
                              params: { orgSlug },
                              to: subItem.to,
                            }),
                          )}
                        >
                          <span>{subItem.label}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

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
} from "@/components/ui/sidebar"

type SecondaryItem = {
  action?: () => void
  icon: Icon
  label: string
  to?: "/platform"
}

export function NavSecondary({ items }: { items: SecondaryItem[] }) {
  const matchRoute = useMatchRoute()

  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupLabel>More</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                render={
                  item.to ? <Link preload="intent" to={item.to} /> : undefined
                }
                isActive={
                  item.to
                    ? Boolean(matchRoute({ fuzzy: true, to: item.to }))
                    : false
                }
                onClick={item.action}
                tooltip={item.label}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

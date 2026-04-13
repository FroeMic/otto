"use client"

import {
  CalendarBlankIcon,
  ChatsTeardropIcon,
  LightningIcon,
  SparkleIcon,
} from "@phosphor-icons/react"
import { Link, useMatchRoute } from "@tanstack/react-router"
import type { ComponentType } from "react"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface WorkspacePrimaryNavProps {
  orgSlug: string
}

interface WorkspacePrimaryNavItemProps {
  icon: ComponentType<{ className?: string }>
  label: string
  orgSlug: string
  to:
    | "/$orgSlug"
    | "/$orgSlug/scheduled-tasks/tasks"
    | "/$orgSlug/skills"
    | "/$orgSlug/sessions"
}

function WorkspacePrimaryNavItem({
  icon: Icon,
  label,
  orgSlug,
  to,
}: WorkspacePrimaryNavItemProps) {
  const matchRoute = useMatchRoute()
  const isActive = Boolean(
    to === "/$orgSlug"
      ? matchRoute({ params: { orgSlug }, to })
      : matchRoute({ fuzzy: true, params: { orgSlug }, to }),
  )

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link params={{ orgSlug }} preload="intent" to={to} />}
        isActive={isActive}
        tooltip={label}
        className="px-2.5"
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function WorkspacePrimaryNav({ orgSlug }: WorkspacePrimaryNavProps) {
  return (
    <SidebarMenu>
      <WorkspacePrimaryNavItem
        icon={SparkleIcon}
        label="Agent"
        orgSlug={orgSlug}
        to="/$orgSlug"
      />
      <WorkspacePrimaryNavItem
        icon={ChatsTeardropIcon}
        label="Sessions"
        orgSlug={orgSlug}
        to="/$orgSlug/sessions"
      />
      <WorkspacePrimaryNavItem
        icon={CalendarBlankIcon}
        label="Scheduled Tasks"
        orgSlug={orgSlug}
        to="/$orgSlug/scheduled-tasks/tasks"
      />
      <WorkspacePrimaryNavItem
        icon={LightningIcon}
        label="Skills"
        orgSlug={orgSlug}
        to="/$orgSlug/skills"
      />
    </SidebarMenu>
  )
}

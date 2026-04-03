"use client";

import {
  ArrowLeft01Icon,
  Settings01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SettingsSidebarProps = React.ComponentProps<typeof Sidebar> & {
  currentOrganization: {
    name: string;
    slug: string;
  };
  user: {
    email: string;
    name: string;
  };
};

const SETTINGS_NAV_ITEMS = {
  user: [
    {
      href: (orgSlug: string) => `/${orgSlug}/settings/user`,
      icon: <HugeiconsIcon icon={UserIcon} />,
      match: "section",
      title: "Account",
    },
  ],
  workspace: [
    {
      href: (orgSlug: string) => `/${orgSlug}/settings/workspace`,
      icon: <HugeiconsIcon icon={Settings01Icon} />,
      match: "exact",
      title: "General",
    },
    {
      href: (orgSlug: string) => `/${orgSlug}/settings/workspace/members`,
      icon: <HugeiconsIcon icon={UserIcon} />,
      match: "section",
      title: "Members",
    },
  ],
} as const;

function isSettingsItemActive(
  href: string,
  match: "exact" | "section",
  pathname: string,
) {
  return match === "exact"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsSidebar({
  currentOrganization,
  user,
  ...props
}: SettingsSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className="gap-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link href={`/${currentOrganization.slug}/agent/status`} />
              }
              size="lg"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} />
              <span>Back to Otto</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>User</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SETTINGS_NAV_ITEMS.user.map((item) => {
                const href = item.href(currentOrganization.slug);
                const isActive = isSettingsItemActive(
                  href,
                  item.match,
                  pathname,
                );

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={href} />}
                      tooltip={item.title}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SETTINGS_NAV_ITEMS.workspace.map((item) => {
                const href = item.href(currentOrganization.slug);
                const isActive = isSettingsItemActive(
                  href,
                  item.match,
                  pathname,
                );

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={href} />}
                      tooltip={item.title}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          currentOrganizationSlug={currentOrganization.slug}
          user={user}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

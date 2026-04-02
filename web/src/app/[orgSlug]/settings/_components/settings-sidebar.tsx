"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Settings01Icon, UserIcon } from "@hugeicons/core-free-icons";
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
      title: "Account",
    },
  ],
  workspace: [
    {
      href: (orgSlug: string) => `/${orgSlug}/settings/workspace`,
      icon: <HugeiconsIcon icon={Settings01Icon} />,
      title: "General",
    },
  ],
} as const;

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
        <div className="flex flex-col gap-1 px-2">
          <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Settings
          </span>
          <span className="text-sm font-medium">
            {currentOrganization.name}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>User</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SETTINGS_NAV_ITEMS.user.map((item) => {
                const href = item.href(currentOrganization.slug);
                const isActive =
                  pathname === href || pathname.startsWith(`${href}/`);

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
                const isActive =
                  pathname === href || pathname.startsWith(`${href}/`);

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

"use client";

import {
  ArrowLeft,
  BuildingOffice,
  CaretUpDown,
  Gear,
  User,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavUser } from "@/components/nav-user";
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

const SETTINGS_NAV_ITEMS = {
  user: [
    {
      href: (orgSlug: string) => `/${orgSlug}/settings/user`,
      icon: <User />,
      match: "section",
      title: "Account",
    },
  ],
  workspace: [
    {
      href: (orgSlug: string) => `/${orgSlug}/settings/workspace`,
      icon: <Gear />,
      match: "exact",
      title: "General",
    },
    {
      href: (orgSlug: string) => `/${orgSlug}/settings/workspace/members`,
      icon: <User />,
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
  organizations,
  user,
  ...props
}: SettingsSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className="gap-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="aria-expanded:bg-muted"
                  />
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
                      render={<Link href={`/${organization.slug}`} />}
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
                      href={`/${currentOrganization.slug}/settings/workspace`}
                    />
                  }
                >
                  <Gear />
                  Workspace settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link href={`/${currentOrganization.slug}/agent/status`} />
              }
              size="lg"
            >
              <ArrowLeft />
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

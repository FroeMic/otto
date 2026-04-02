"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowReloadHorizontalIcon,
  Building03Icon,
  Calendar03Icon,
  UnfoldMoreIcon,
  Settings01Icon,
  FlashIcon,
  ConnectIcon,
  AiChat02Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
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
import type { DashboardOrganization } from "@/db/control-plane";
import { isSlackConnected } from "@/lib/workspace";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  currentOrganization: DashboardOrganization;
  organizations: Array<{
    name: string;
    slug: string;
  }>;
  user: {
    email: string;
    name: string;
  };
};

export function AppSidebar({
  currentOrganization,
  organizations,
  user,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname();
  const slackIsConnected = isSlackConnected(currentOrganization);

  const navItems = [
    {
      href: `/${currentOrganization.slug}/agent/status`,
      icon: <HugeiconsIcon icon={AiChat02Icon} />,
      title: "Agent",
    },
    {
      href: `/${currentOrganization.slug}/integrations`,
      icon: <HugeiconsIcon icon={ConnectIcon} />,
      title: "Integrations",
    },
    {
      href: `/${currentOrganization.slug}/tools`,
      icon: <HugeiconsIcon icon={Wrench01Icon} />,
      title: "Tools",
    },
    {
      href: `/${currentOrganization.slug}/skills`,
      icon: <HugeiconsIcon icon={FlashIcon} />,
      title: "Skills",
    },
    {
      href: `/${currentOrganization.slug}/scheduled-tasks`,
      icon: <HugeiconsIcon icon={Calendar03Icon} />,
      title: "Scheduled Tasks",
    },
  ];

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
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
                  <HugeiconsIcon icon={Building03Icon} />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {currentOrganization.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {currentOrganization.slug}
                  </span>
                </div>
                <HugeiconsIcon icon={UnfoldMoreIcon} className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                  {organizations.map((organization) => (
                    <DropdownMenuItem
                      key={organization.slug}
                      render={<Link href={`/${organization.slug}`} />}
                    >
                      <HugeiconsIcon icon={Building03Icon} />
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
                  <HugeiconsIcon icon={Settings01Icon} />
                  Workspace settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Otto</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.href} />}
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
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Connections</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      href={`/${currentOrganization.slug}/integrations/slack`}
                    />
                  }
                >
                  {slackIsConnected ? (
                    <>
                      <HugeiconsIcon icon={ConnectIcon} />
                      <span>Slack</span>
                      <span
                        aria-hidden="true"
                        className="ml-auto size-2 rounded-full bg-emerald-500"
                      />
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon icon={ArrowReloadHorizontalIcon} />
                      <span>Connect Slack</span>
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
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

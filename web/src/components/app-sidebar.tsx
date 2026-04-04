"use client";

import {
  ArrowsClockwise,
  Brain,
  BuildingOffice,
  CalendarBlank,
  CaretUpDown,
  ChatCenteredDots,
  ChatsTeardrop,
  Gear,
  Lightning,
  PlugsConnected,
  Wrench,
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
    isPlatformAdmin: boolean;
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
      icon: <ChatCenteredDots />,
      title: "Agent",
    },
    {
      href: `/${currentOrganization.slug}/integrations`,
      icon: <PlugsConnected />,
      title: "Integrations",
    },
    {
      href: `/${currentOrganization.slug}/tools`,
      icon: <Wrench />,
      title: "Tools",
    },
    {
      href: `/${currentOrganization.slug}/capabilities`,
      icon: <Brain />,
      title: "Capabilities",
    },
    {
      href: `/${currentOrganization.slug}/skills`,
      icon: <Lightning />,
      title: "Skills",
    },
    {
      href: `/${currentOrganization.slug}/sessions`,
      icon: <ChatsTeardrop />,
      title: "Sessions",
    },
    {
      href: `/${currentOrganization.slug}/scheduled-tasks`,
      icon: <CalendarBlank />,
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
                      <PlugsConnected />
                      <span>Slack</span>
                      <span
                        aria-hidden="true"
                        className="ml-auto size-2 rounded-full bg-emerald-500"
                      />
                    </>
                  ) : (
                    <>
                      <ArrowsClockwise />
                      <span>Connect Slack</span>
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {user.isPlatformAdmin ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/platform/organizations" />}
                  >
                    <BuildingOffice />
                    <span>Platform Administration</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
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

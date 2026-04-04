"use client";

import { ArrowLeft01Icon, Building03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PlatformUserMenu } from "@/app/platform/_components/platform-user-menu";
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

type PlatformSidebarProps = React.ComponentProps<typeof Sidebar> & {
  organizations: Array<{
    name: string;
    slug: string;
  }>;
  user: {
    email: string;
    name: string;
  };
};

export function PlatformSidebar({
  organizations,
  user,
  ...props
}: PlatformSidebarProps) {
  const pathname = usePathname();
  const firstWorkspace = organizations[0] ?? null;
  const organizationsHref = "/platform/organizations";
  const organizationsIsActive =
    pathname === organizationsHref ||
    pathname.startsWith(`${organizationsHref}/`);

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className="gap-3">
        {firstWorkspace ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href={`/${firstWorkspace.slug}/agent/status`} />}
                size="lg"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} />
                <span>Back to Otto</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={organizationsIsActive}
                  render={<Link href={organizationsHref} />}
                  tooltip="Organizations"
                >
                  <HugeiconsIcon icon={Building03Icon} />
                  <span>Organizations</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <PlatformUserMenu organizations={organizations} user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

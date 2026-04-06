"use client";

import { ArrowLeft, BuildingOffice } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlatformUserMenu } from "@/app/platform/_components/platform-user-menu";
import {
  getPlatformOrganizationsHref,
  usePlatformSourceWorkspaceSlug,
} from "@/app/platform/_lib/source-workspace";
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
    id: string;
    name: string;
  };
};

export function PlatformSidebar({
  organizations,
  user,
  ...props
}: PlatformSidebarProps) {
  const pathname = usePathname();
  const sourceWorkspaceSlug = usePlatformSourceWorkspaceSlug(organizations);
  const organizationsHref = "/platform/organizations";
  const organizationsIsActive =
    pathname === organizationsHref ||
    pathname.startsWith(`${organizationsHref}/`);

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className="gap-3">
        {sourceWorkspaceSlug ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href={`/${sourceWorkspaceSlug}/agent/status`} />}
                size="lg"
              >
                <ArrowLeft />
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
                  render={
                    <Link
                      href={
                        sourceWorkspaceSlug
                          ? getPlatformOrganizationsHref(sourceWorkspaceSlug)
                          : organizationsHref
                      }
                    />
                  }
                  tooltip="Organizations"
                >
                  <BuildingOffice />
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

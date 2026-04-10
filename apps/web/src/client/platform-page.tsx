import {
  BuildingsIcon,
  GearSixIcon,
  HouseLineIcon,
  SignOutIcon,
  SparkleIcon,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export function PlatformPage() {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-4 border-b border-sidebar-border/70">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
              <SparkleIcon weight="fill" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium">Otto</p>
              <p className="truncate text-xs text-sidebar-foreground/70">
                Platform
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive tooltip="Overview">
                    <BuildingsIcon />
                    <span>Overview</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Navigate</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      window.location.assign("/")
                    }}
                    tooltip="Home"
                  >
                    <HouseLineIcon />
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      window.location.assign("/login")
                    }}
                    tooltip="Login"
                  >
                    <GearSixIcon />
                    <span>Login</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border/70">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  window.location.assign("/auth/sign-out")
                }}
                tooltip="Sign out"
              >
                <SignOutIcon />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur md:px-6">
          <SidebarTrigger />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Platform</p>
            <p className="truncate text-xs text-muted-foreground">
              Operator-facing area
            </p>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-4 py-6 md:px-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
              Platform
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Platform shell is mounted
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              This route is now a separate lazy-loaded layout surface inside the
              SPA, ready for the operator pages to move over incrementally.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm">
              <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
                Route
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight">
                /platform
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Lazy-loaded as a distinct operator surface.
              </p>
            </section>

            <section className="rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm">
              <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
                Next cut
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight">
                Operator pages
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Organizations, detail views, and queued actions can move in one
                slice at a time without reworking the shell again.
              </p>
            </section>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href="/" className="inline-flex">
              <Button variant="outline">Back to home</Button>
            </a>
            <a href="/login?returnTo=%2Fplatform" className="inline-flex">
              <Button>Sign in for platform</Button>
            </a>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

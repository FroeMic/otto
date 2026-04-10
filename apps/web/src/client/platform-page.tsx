import { RocketLaunchIcon } from "@phosphor-icons/react"

import { PlatformSidebar } from "@/components/platform-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function PlatformPage() {
  return (
    <SidebarProvider>
      <PlatformSidebar />

      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <SidebarSeparator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbPage>Platform</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Overview</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
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
                Organizations
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The platform shell is ready for the organizations index and its
                deeper operator views to move over without another shell reset.
              </p>
            </section>

            <section className="rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm">
              <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
                Status
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <RocketLaunchIcon weight="fill" />
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-tight">
                    Operator shell ready
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Navigation and layout can stay stable while platform pages
                    migrate one slice at a time.
                  </p>
                </div>
              </div>
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

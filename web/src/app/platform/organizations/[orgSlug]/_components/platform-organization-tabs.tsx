"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const PLATFORM_ORGANIZATION_TABS = [
  {
    href: (orgSlug: string) => `/platform/organizations/${orgSlug}/overview`,
    label: "Overview",
  },
  {
    href: (orgSlug: string) => `/platform/organizations/${orgSlug}/access`,
    label: "Access",
  },
  {
    href: (orgSlug: string) => `/platform/organizations/${orgSlug}/jobs`,
    label: "Jobs",
  },
  {
    href: (orgSlug: string) => `/platform/organizations/${orgSlug}/events`,
    label: "Events",
  },
  {
    href: (orgSlug: string) => `/platform/organizations/${orgSlug}/logs`,
    label: "Logs",
  },
] as const;

export function PlatformOrganizationTabs({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();

  return (
    <div className="inline-flex w-fit items-center rounded-full bg-muted p-[3px] text-xs text-muted-foreground">
      {PLATFORM_ORGANIZATION_TABS.map((tab) => {
        const href = tab.href(orgSlug);
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center justify-center rounded-full border border-transparent px-2.5 text-xs font-medium transition-colors hover:text-foreground",
              isActive ? "bg-background text-foreground" : "text-foreground/60",
            )}
            href={href}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

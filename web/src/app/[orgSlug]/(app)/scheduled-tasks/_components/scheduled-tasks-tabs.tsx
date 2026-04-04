"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SCHEDULED_TASK_TABS = [
  {
    href: (orgSlug: string) => `/${orgSlug}/scheduled-tasks/tasks`,
    label: "Scheduled Tasks",
  },
  {
    href: (orgSlug: string) => `/${orgSlug}/scheduled-tasks/task-runs`,
    label: "Task Runs",
  },
] as const;

export function ScheduledTasksTabs({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();

  return (
    <div className="inline-flex w-fit items-center rounded-full bg-muted p-[3px] text-xs text-muted-foreground">
      {SCHEDULED_TASK_TABS.map((tab) => {
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

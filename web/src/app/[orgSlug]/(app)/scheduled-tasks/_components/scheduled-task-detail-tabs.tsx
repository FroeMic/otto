"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const DETAIL_TABS = [
  {
    href: (orgSlug: string, taskKey: string) =>
      `/${orgSlug}/scheduled-tasks/tasks/${encodeURIComponent(taskKey)}/setup`,
    label: "Setup",
  },
  {
    href: (orgSlug: string, taskKey: string) =>
      `/${orgSlug}/scheduled-tasks/tasks/${encodeURIComponent(taskKey)}/task-runs`,
    label: "Task Runs",
  },
] as const;

export function ScheduledTaskDetailTabs({
  orgSlug,
  taskKey,
}: {
  orgSlug: string;
  taskKey: string;
}) {
  const pathname = usePathname();

  return (
    <div className="inline-flex w-fit items-center rounded-full bg-muted p-[3px] text-xs text-muted-foreground">
      {DETAIL_TABS.map((tab) => {
        const href = tab.href(orgSlug, taskKey);
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

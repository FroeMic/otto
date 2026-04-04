"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

import { ScheduledTaskDetailTabs } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-task-detail-tabs";
import { useSetBreadcrumbs } from "@/components/breadcrumb-context";
import { Badge } from "@/components/ui/badge";

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  paused: "secondary",
  sync_failed: "destructive",
};

export function ScheduledTaskDetailShell({
  children,
  orgSlug,
  task,
}: {
  children: ReactNode;
  orgSlug: string;
  task: {
    description: string | null;
    name: string;
    status: string;
    taskKey: string;
  };
}) {
  const setBreadcrumbs = useSetBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: "Scheduled Tasks", href: `/${orgSlug}/scheduled-tasks/tasks` },
      { label: task.name },
    ]);
    return () => setBreadcrumbs([]);
  }, [orgSlug, task.name, setBreadcrumbs]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            {task.name}
          </h2>
          <Badge variant={statusBadgeVariant[task.status] ?? "outline"}>
            {formatStatusLabel(task.status)}
          </Badge>
        </div>
        {task.description ? (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {task.description}
          </p>
        ) : null}
      </div>

      <ScheduledTaskDetailTabs orgSlug={orgSlug} taskKey={task.taskKey} />

      {children}
    </div>
  );
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

import Link from "next/link";
import type { ReactNode } from "react";

import { ScheduledTaskDetailTabs } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-task-detail-tabs";
import { Badge } from "@/components/ui/badge";
import { describeScheduledTaskSchedule } from "@/lib/scheduled-tasks/cron-description";

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
    enabled: boolean;
    lastRunAt: Date | null;
    name: string;
    nextRunAt: Date | null;
    scheduleExpression: string;
    scheduleJson: Record<string, unknown> | null;
    status: string;
    taskKey: string;
    timezone: string | null;
  };
}) {
  const scheduleDescription = describeScheduledTaskSchedule({
    scheduleExpression: task.scheduleExpression,
    scheduleJson: task.scheduleJson,
    timezone: task.timezone,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href={`/${orgSlug}/scheduled-tasks/tasks`}
        >
          Back to scheduled tasks
        </Link>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              {task.name}
            </h2>
            <Badge variant={statusBadgeVariant[task.status] ?? "outline"}>
              {formatStatusLabel(task.status)}
            </Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {task.description ?? scheduleDescription}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span>Schedule: {scheduleDescription}</span>
            <span>Next run: {formatDateTime(task.nextRunAt)}</span>
            <span>Last run: {formatDateTime(task.lastRunAt)}</span>
            <span>{task.enabled ? "Enabled" : "Disabled"}</span>
          </div>
        </div>
      </div>

      <ScheduledTaskDetailTabs orgSlug={orgSlug} taskKey={task.taskKey} />

      {children}
    </div>
  );
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

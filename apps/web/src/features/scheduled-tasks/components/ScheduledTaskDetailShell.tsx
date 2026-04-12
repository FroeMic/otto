import { Badge } from "@/components/ui/badge"

import type {
  WorkspaceScheduledTaskDetail,
  WorkspaceScheduledTaskDetailSection,
} from "../types"
import { ScheduledTaskDetailTabs } from "./ScheduledTaskDetailTabs"

export interface ScheduledTaskDetailShellProps {
  currentSection: WorkspaceScheduledTaskDetailSection
  orgSlug: string
  task: WorkspaceScheduledTaskDetail
}

export function ScheduledTaskDetailShell({
  currentSection,
  orgSlug,
  task,
}: ScheduledTaskDetailShellProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{task.name}</h2>
          <Badge variant={statusBadgeVariant[task.status] ?? "outline"}>
            {formatStatusLabel(task.status)}
          </Badge>
        </div>
        {task.description ? (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {task.description}
          </p>
        ) : null}
        {task.status === "deleted" ? (
          <p className="max-w-3xl text-sm text-muted-foreground">
            This task was deleted from the runtime and is kept here for
            historical visibility.
          </p>
        ) : null}
      </div>

      <ScheduledTaskDetailTabs
        currentSection={currentSection}
        orgSlug={orgSlug}
        taskKey={encodeURIComponent(task.taskKey)}
      />
    </div>
  )
}

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  deleted: "outline",
  paused: "secondary",
  sync_failed: "destructive",
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

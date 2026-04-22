import type {
  WorkspaceScheduledTaskDetailResponse,
  WorkspaceScheduledTaskRunsResponse,
  WorkspaceScheduledTasksListResponse,
} from "@otto/feature-runtime-core/scheduled-tasks/workspace-contracts"

export type WorkspaceScheduledTask =
  WorkspaceScheduledTasksListResponse["tasks"][number]

export type WorkspaceScheduledTaskRun =
  WorkspaceScheduledTaskRunsResponse["runs"][number]

export type WorkspaceScheduledTaskDetail = NonNullable<
  WorkspaceScheduledTaskDetailResponse["task"]
>

export type WorkspaceScheduledTasksSection = "tasks" | "task-runs"

export type WorkspaceScheduledTaskDetailSection =
  | "overview"
  | "configuration"
  | "task-runs"

export interface ScheduledTasksSyncState {
  label: string
  message: string | null
  variant: "default" | "secondary" | "outline" | "destructive"
}

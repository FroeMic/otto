import type {
  WorkspaceScheduledTaskDetailResponse,
  WorkspaceScheduledTasksListResponse,
} from "@otto/feature-runtime-core/scheduled-tasks/workspace-contracts"

import type { ScheduledTasksSyncState } from "../types"

const SCHEDULED_TASKS_STALE_AFTER_MS = 15 * 60 * 1000

function isScheduledTaskStale(value: Date) {
  return Date.now() - value.getTime() > SCHEDULED_TASKS_STALE_AFTER_MS
}

type ScheduledTaskSyncRow = Pick<
  WorkspaceScheduledTasksListResponse["tasks"][number],
  "lastSyncError" | "status"
>

type ScheduledTaskSyncJob = WorkspaceScheduledTasksListResponse["latestRefreshJob"]

export function getScheduledTasksSyncState(input: {
  latestRefreshJob: ScheduledTaskSyncJob
  latestSyncedAt: string | null
  tasks?: ScheduledTaskSyncRow[]
}): ScheduledTasksSyncState {
  const latestSyncedAt = input.latestSyncedAt
    ? new Date(input.latestSyncedAt)
    : null
  const hasSyncFailure =
    input.tasks?.some(
      (task) => task.status === "sync_failed" || Boolean(task.lastSyncError),
    ) ?? false

  if (
    input.latestRefreshJob?.status === "queued" ||
    input.latestRefreshJob?.status === "running"
  ) {
    return {
      label: "Refreshing",
      message: "A runtime refresh job is currently running.",
      variant: "outline",
    }
  }

  if (input.latestRefreshJob?.status === "failed") {
    return {
      label: "Sync failed",
      message:
        input.latestRefreshJob.error ??
        "The latest runtime refresh failed. Use the refresh action to retry.",
      variant: "destructive",
    }
  }

  if (!latestSyncedAt && !input.latestRefreshJob) {
    return {
      label: "Not synced",
      message:
        "Run the first refresh to import scheduled tasks from the runtime.",
      variant: "outline",
    }
  }

  if (hasSyncFailure) {
    return {
      label: "Sync failed",
      message:
        "Stored scheduled task data is out of sync with the runtime. Refresh to repair it.",
      variant: "destructive",
    }
  }

  if (latestSyncedAt && isScheduledTaskStale(latestSyncedAt)) {
    return {
      label: "Stale",
      message:
        "This view is showing older runtime data. Refresh from the runtime to pull the latest scheduled tasks and task runs.",
      variant: "outline",
    }
  }

  return {
    label: "Current",
    message: null,
    variant: "secondary",
  }
}

export function getScheduledTaskDetailSyncRows(
  detail: WorkspaceScheduledTaskDetailResponse,
) {
  return detail.task
    ? [{ lastSyncError: detail.task.lastSyncError, status: detail.task.status }]
    : []
}

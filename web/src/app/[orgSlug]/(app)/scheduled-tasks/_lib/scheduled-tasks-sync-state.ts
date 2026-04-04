import type { getLatestTenantScheduledTasksRefreshJob } from "@/db/scheduled-tasks";
import { isScheduledTaskStale } from "@/db/scheduled-tasks";

export type ScheduledTasksSyncState = {
  label: string;
  message: string | null;
  variant: "default" | "secondary" | "outline" | "destructive";
};

type ScheduledTaskSyncJob = Awaited<
  ReturnType<typeof getLatestTenantScheduledTasksRefreshJob>
>;

type ScheduledTaskSyncRow = {
  lastSyncError: string | null;
  lastSyncedAt: Date;
  status: string;
};

export function getLatestScheduledTasksSyncTimestamp(
  jobs: ScheduledTaskSyncRow[],
) {
  return jobs.reduce<Date | null>((latest, job) => {
    if (!latest) {
      return job.lastSyncedAt;
    }

    return latest > job.lastSyncedAt ? latest : job.lastSyncedAt;
  }, null);
}

export function getScheduledTasksSyncState(input: {
  jobs: ScheduledTaskSyncRow[];
  latestRefreshJob: ScheduledTaskSyncJob;
}): ScheduledTasksSyncState {
  const latestSyncedAt = getLatestScheduledTasksSyncTimestamp(input.jobs);
  const hasSyncFailure = input.jobs.some(
    (job) => job.status === "sync_failed" || job.lastSyncError,
  );

  if (
    input.latestRefreshJob?.status === "queued" ||
    input.latestRefreshJob?.status === "running"
  ) {
    return {
      label: "Refreshing",
      message: "A runtime refresh job is currently running.",
      variant: "outline",
    };
  }

  if (input.latestRefreshJob?.status === "failed") {
    return {
      label: "Sync failed",
      message:
        input.latestRefreshJob.error ??
        "The latest runtime refresh failed. Use the refresh action to retry.",
      variant: "destructive",
    };
  }

  if (!latestSyncedAt && !input.latestRefreshJob) {
    return {
      label: "Not synced",
      message:
        "Run the first refresh to import scheduled tasks from the runtime.",
      variant: "outline",
    };
  }

  if (hasSyncFailure) {
    return {
      label: "Sync failed",
      message:
        "Stored scheduled task data is out of sync with the runtime. Refresh to repair it.",
      variant: "destructive",
    };
  }

  if (latestSyncedAt && isScheduledTaskStale(latestSyncedAt)) {
    return {
      label: "Stale",
      message:
        "This view is showing older runtime data. Refresh from runtime to pull the latest jobs and runs.",
      variant: "outline",
    };
  }

  return {
    label: "Current",
    message: null,
    variant: "secondary",
  };
}

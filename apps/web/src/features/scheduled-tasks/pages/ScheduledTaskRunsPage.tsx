import { useSuspenseQuery } from "@tanstack/react-query"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { workspaceScheduledTaskRunsQueryOptions } from "../api/scheduled-tasks"
import { ScheduledTaskRunsTable } from "../components/ScheduledTaskRunsTable"
import { ScheduledTasksShell } from "../components/ScheduledTasksShell"
import { getScheduledTasksSyncState } from "../lib/sync-state"

export interface ScheduledTaskRunsPageProps {
  orgSlug: string
}

export function ScheduledTaskRunsPage({ orgSlug }: ScheduledTaskRunsPageProps) {
  const { data } = useSuspenseQuery(
    workspaceScheduledTaskRunsQueryOptions(orgSlug),
  )
  const syncState = getScheduledTasksSyncState({
    latestRefreshJob: data.latestRefreshJob,
    latestSyncedAt: data.latestSyncedAt,
  })

  return (
    <ScheduledTasksShell
      currentSection="task-runs"
      dateTimePreferences={data.dateTimePreferences}
      lastSyncedAt={data.latestSyncedAt}
      orgSlug={orgSlug}
      syncState={syncState}
    >
      {data.state === "pending_setup" ? (
        <Alert>
          <AlertTitle>No Otto runtime yet</AlertTitle>
          <AlertDescription>
            Scheduled task runs will appear here once Otto has been provisioned
            for this workspace.
          </AlertDescription>
        </Alert>
      ) : (
        <ScheduledTaskRunsTable
          dateTimePreferences={data.dateTimePreferences}
          orgSlug={orgSlug}
          runs={data.runs}
        />
      )}
    </ScheduledTasksShell>
  )
}

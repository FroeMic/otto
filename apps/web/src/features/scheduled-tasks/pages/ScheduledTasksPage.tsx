import { useSuspenseQuery } from "@tanstack/react-query"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { workspaceScheduledTasksQueryOptions } from "../api/scheduled-tasks"
import { ScheduledTasksEmptyState } from "../components/ScheduledTasksEmptyState"
import { ScheduledTasksShell } from "../components/ScheduledTasksShell"
import { ScheduledTasksTable } from "../components/ScheduledTasksTable"
import { getScheduledTasksSyncState } from "../lib/sync-state"

export interface ScheduledTasksPageProps {
  orgSlug: string
}

export function ScheduledTasksPage({ orgSlug }: ScheduledTasksPageProps) {
  const { data } = useSuspenseQuery(workspaceScheduledTasksQueryOptions(orgSlug))
  const syncState = getScheduledTasksSyncState({
    latestRefreshJob: data.latestRefreshJob,
    latestSyncedAt: data.latestSyncedAt,
    tasks: data.tasks,
  })

  return (
    <ScheduledTasksShell
      currentSection="tasks"
      dateTimePreferences={data.dateTimePreferences}
      lastSyncedAt={data.latestSyncedAt}
      orgSlug={orgSlug}
      syncState={syncState}
    >
      {data.state === "pending_setup" ? (
        <Alert>
          <AlertTitle>No Otto runtime yet</AlertTitle>
          <AlertDescription>
            Scheduled tasks will appear here once Otto has been provisioned for
            this workspace.
          </AlertDescription>
        </Alert>
      ) : data.tasks.length === 0 ? (
        <ScheduledTasksEmptyState />
      ) : (
        <ScheduledTasksTable
          dateTimePreferences={data.dateTimePreferences}
          orgSlug={orgSlug}
          tasks={data.tasks}
        />
      )}
    </ScheduledTasksShell>
  )
}


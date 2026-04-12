import { useSuspenseQuery } from "@tanstack/react-query"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { workspaceScheduledTaskDetailQueryOptions } from "../api/scheduled-tasks"
import { ScheduledTaskConfigurationPanel } from "../components/ScheduledTaskConfigurationPanel"
import { ScheduledTaskDetailShell } from "../components/ScheduledTaskDetailShell"
import { ScheduledTasksShell } from "../components/ScheduledTasksShell"
import {
  getScheduledTaskDetailSyncRows,
  getScheduledTasksSyncState,
} from "../lib/sync-state"

export interface ScheduledTaskConfigurationPageProps {
  orgSlug: string
  taskKey: string
}

export function ScheduledTaskConfigurationPage({
  orgSlug,
  taskKey,
}: ScheduledTaskConfigurationPageProps) {
  const { data } = useSuspenseQuery(
    workspaceScheduledTaskDetailQueryOptions({
      orgSlug,
      taskKey,
    }),
  )
  const syncState = getScheduledTasksSyncState({
    latestRefreshJob: data.latestRefreshJob,
    latestSyncedAt: data.latestSyncedAt,
    tasks: getScheduledTaskDetailSyncRows(data),
  })

  return (
    <ScheduledTasksShell
      currentSection="tasks"
      dateTimePreferences={data.dateTimePreferences}
      hideHeader
      lastSyncedAt={data.latestSyncedAt}
      orgSlug={orgSlug}
      showTabs={false}
      syncState={syncState}
    >
      {data.state === "pending_setup" || !data.task ? (
        <Alert>
          <AlertTitle>Runtime not ready</AlertTitle>
          <AlertDescription>
            This workspace does not have a ready Otto runtime yet, so scheduled
            task details are not available here.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-6">
          <ScheduledTaskDetailShell
            currentSection="configuration"
            orgSlug={orgSlug}
            task={data.task}
          />
          <ScheduledTaskConfigurationPanel
            dateTimePreferences={data.dateTimePreferences}
            task={data.task}
          />
        </div>
      )}
    </ScheduledTasksShell>
  )
}

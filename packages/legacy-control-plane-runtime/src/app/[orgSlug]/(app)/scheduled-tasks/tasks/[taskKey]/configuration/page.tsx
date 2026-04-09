import { notFound } from "next/navigation";

import { ScheduledTaskConfigurationContent } from "../../../_components/scheduled-task-detail-content";
import { ScheduledTaskDetailShell } from "../../../_components/scheduled-task-detail-shell";
import { ScheduledTasksEmptyState } from "../../../_components/scheduled-tasks-empty-state";
import { ScheduledTasksShell } from "../../../_components/scheduled-tasks-shell";
import { loadScheduledTaskDetail } from "../../../_lib/load-scheduled-task-detail";
import {
  getLatestScheduledTasksSyncTimestamp,
  getScheduledTasksSyncState,
} from "../../../_lib/scheduled-tasks-sync-state";
import { resolveDateTimePreferences } from "../../../../../../../lib/date-time";

export const dynamic = "force-dynamic";

export default async function ScheduledTaskConfigurationPage({
  params,
}: {
  params: Promise<{ orgSlug: string; taskKey: string }>;
}) {
  const { orgSlug, taskKey } = await params;
  const { agent, latestRefreshJob, organization, task } =
    await loadScheduledTaskDetail({
      orgSlug,
      taskKey,
    });

  if (!agent) {
    return <ScheduledTasksEmptyState />;
  }

  if (!task) {
    notFound();
  }

  const dateTimePreferences = resolveDateTimePreferences({
    locale: organization.locale,
    timeFormatPreference: organization.timeFormatPreference,
    timeZone: organization.timezone,
  });

  return (
    <ScheduledTasksShell
      dateTimePreferences={dateTimePreferences}
      hideHeader
      lastSyncedAt={getLatestScheduledTasksSyncTimestamp([task])}
      orgSlug={organization.slug}
      showTabs={false}
      syncState={getScheduledTasksSyncState({
        jobs: [task],
        latestRefreshJob,
      })}
    >
      <ScheduledTaskDetailShell orgSlug={organization.slug} task={task}>
        <ScheduledTaskConfigurationContent
          dateTimePreferences={dateTimePreferences}
          task={task}
        />
      </ScheduledTaskDetailShell>
    </ScheduledTasksShell>
  );
}

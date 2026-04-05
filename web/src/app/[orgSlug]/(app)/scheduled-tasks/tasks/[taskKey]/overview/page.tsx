import { notFound } from "next/navigation";

import { ScheduledTaskOverviewContent } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-task-detail-content";
import { ScheduledTaskDetailShell } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-task-detail-shell";
import { ScheduledTasksEmptyState } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-tasks-empty-state";
import { ScheduledTasksShell } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-tasks-shell";
import { loadScheduledTaskDetail } from "@/app/[orgSlug]/(app)/scheduled-tasks/_lib/load-scheduled-task-detail";
import {
  getLatestScheduledTasksSyncTimestamp,
  getScheduledTasksSyncState,
} from "@/app/[orgSlug]/(app)/scheduled-tasks/_lib/scheduled-tasks-sync-state";
import { resolveDateTimePreferences } from "@/lib/date-time";

export const dynamic = "force-dynamic";

export default async function ScheduledTaskOverviewPage({
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
        <ScheduledTaskOverviewContent
          dateTimePreferences={dateTimePreferences}
          task={task}
        />
      </ScheduledTaskDetailShell>
    </ScheduledTasksShell>
  );
}

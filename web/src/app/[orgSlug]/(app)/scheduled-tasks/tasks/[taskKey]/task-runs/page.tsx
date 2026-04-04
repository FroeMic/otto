import { notFound } from "next/navigation";

import { ScheduledRunsContent } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-runs-content";
import { ScheduledTaskDetailShell } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-task-detail-shell";
import { ScheduledTasksEmptyState } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-tasks-empty-state";
import { ScheduledTasksShell } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-tasks-shell";
import { loadScheduledTaskDetail } from "@/app/[orgSlug]/(app)/scheduled-tasks/_lib/load-scheduled-task-detail";
import {
  getLatestScheduledTasksSyncTimestamp,
  getScheduledTasksSyncState,
} from "@/app/[orgSlug]/(app)/scheduled-tasks/_lib/scheduled-tasks-sync-state";
import { listTenantScheduledTaskSessions } from "@/db/scheduled-tasks";
import { resolveDateTimePreferences } from "@/lib/date-time";

export const dynamic = "force-dynamic";

export default async function ScheduledTaskRunsDetailPage({
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

  const runs = await listTenantScheduledTaskSessions({
    limit: 100,
    taskKey,
    tenantId: agent.id,
  });
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
        <ScheduledRunsContent
          dateTimePreferences={dateTimePreferences}
          hideTaskColumn
          orgSlug={organization.slug}
          runs={runs}
        />
      </ScheduledTaskDetailShell>
    </ScheduledTasksShell>
  );
}

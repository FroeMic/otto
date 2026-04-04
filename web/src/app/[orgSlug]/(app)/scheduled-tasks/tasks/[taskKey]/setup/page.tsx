import { notFound } from "next/navigation";

import { ScheduledTaskDetailShell } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-task-detail-shell";
import { ScheduledTaskSetupContent } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-task-setup-content";
import { ScheduledTasksEmptyState } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-tasks-empty-state";
import { ScheduledTasksShell } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-tasks-shell";
import { loadScheduledTaskDetail } from "@/app/[orgSlug]/(app)/scheduled-tasks/_lib/load-scheduled-task-detail";
import {
  getLatestScheduledTasksSyncTimestamp,
  getScheduledTasksSyncState,
} from "@/app/[orgSlug]/(app)/scheduled-tasks/_lib/scheduled-tasks-sync-state";

export const dynamic = "force-dynamic";

export default async function ScheduledTaskSetupPage({
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

  return (
    <ScheduledTasksShell
      lastSyncedAt={getLatestScheduledTasksSyncTimestamp([task])}
      orgSlug={organization.slug}
      syncState={getScheduledTasksSyncState({
        jobs: [task],
        latestRefreshJob,
      })}
    >
      <ScheduledTaskDetailShell orgSlug={organization.slug} task={task}>
        <ScheduledTaskSetupContent task={task} />
      </ScheduledTaskDetailShell>
    </ScheduledTasksShell>
  );
}

import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { ScheduledRunsContent } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-runs-content";
import { ScheduledTasksEmptyState } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-tasks-empty-state";
import { ScheduledTasksShell } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-tasks-shell";
import {
  getLatestScheduledTasksSyncTimestamp,
  getScheduledTasksSyncState,
} from "@/app/[orgSlug]/(app)/scheduled-tasks/_lib/scheduled-tasks-sync-state";
import {
  getLatestTenantScheduledTasksRefreshJob,
  listTenantScheduledTaskSessions,
  listTenantScheduledTasks,
} from "@/db/scheduled-tasks";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ScheduledTaskRunsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const agent = getPrimaryAgent(organization);

  if (!agent) {
    return <ScheduledTasksEmptyState />;
  }

  const [jobs, runs, latestRefreshJob] = await Promise.all([
    listTenantScheduledTasks({ tenantId: agent.id }),
    listTenantScheduledTaskSessions({ tenantId: agent.id, limit: 100 }),
    getLatestTenantScheduledTasksRefreshJob({ tenantId: agent.id }),
  ]);

  return (
    <ScheduledTasksShell
      lastSyncedAt={getLatestScheduledTasksSyncTimestamp(jobs)}
      orgSlug={organization.slug}
      syncState={getScheduledTasksSyncState({
        jobs,
        latestRefreshJob,
      })}
    >
      <ScheduledRunsContent orgSlug={organization.slug} runs={runs} />
    </ScheduledTasksShell>
  );
}

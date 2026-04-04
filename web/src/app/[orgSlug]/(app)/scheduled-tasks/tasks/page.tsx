import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { ScheduledJobsContent } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-jobs-content";
import { ScheduledTasksEmptyState } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-tasks-empty-state";
import { ScheduledTasksShell } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-tasks-shell";
import {
  getLatestScheduledTasksSyncTimestamp,
  getScheduledTasksSyncState,
} from "@/app/[orgSlug]/(app)/scheduled-tasks/_lib/scheduled-tasks-sync-state";
import {
  getLatestTenantScheduledTasksRefreshJob,
  listTenantScheduledTasks,
} from "@/db/scheduled-tasks";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ScheduledTasksPage({
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

  const [jobs, latestRefreshJob] = await Promise.all([
    listTenantScheduledTasks({ tenantId: agent.id }),
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
      <ScheduledJobsContent jobs={jobs} orgSlug={organization.slug} />
    </ScheduledTasksShell>
  );
}

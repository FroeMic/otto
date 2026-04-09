import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "../../../_lib/organization-context";
import { ScheduledJobsContent } from "../_components/scheduled-jobs-content";
import { ScheduledTasksEmptyState } from "../_components/scheduled-tasks-empty-state";
import { ScheduledTasksShell } from "../_components/scheduled-tasks-shell";
import {
  getLatestScheduledTasksSyncTimestamp,
  getScheduledTasksSyncState,
} from "../_lib/scheduled-tasks-sync-state";
import {
  getLatestTenantScheduledTasksRefreshJob,
  listTenantScheduledTasks,
} from "../../../../../db/scheduled-tasks";
import { resolveDateTimePreferences } from "../../../../../lib/date-time";
import { getPrimaryAgent, isOrganizationUnlocked } from "../../../../../lib/workspace";

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
  const dateTimePreferences = resolveDateTimePreferences({
    locale: organization.locale,
    timeFormatPreference: organization.timeFormatPreference,
    timeZone: organization.timezone,
  });

  return (
    <ScheduledTasksShell
      dateTimePreferences={dateTimePreferences}
      lastSyncedAt={getLatestScheduledTasksSyncTimestamp(jobs)}
      orgSlug={organization.slug}
      syncState={getScheduledTasksSyncState({
        jobs,
        latestRefreshJob,
      })}
    >
      <ScheduledJobsContent
        dateTimePreferences={dateTimePreferences}
        jobs={jobs}
        orgSlug={organization.slug}
      />
    </ScheduledTasksShell>
  );
}

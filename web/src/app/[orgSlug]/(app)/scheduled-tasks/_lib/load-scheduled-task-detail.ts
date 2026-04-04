import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  getLatestTenantScheduledTasksRefreshJob,
  getTenantScheduledTask,
} from "@/db/scheduled-tasks";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

export async function loadScheduledTaskDetail(input: {
  orgSlug: string;
  taskKey: string;
}) {
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(input.orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const agent = getPrimaryAgent(organization);

  if (!agent) {
    return {
      agent: null,
      latestRefreshJob: null,
      organization,
      task: null,
    };
  }

  const [task, latestRefreshJob] = await Promise.all([
    getTenantScheduledTask({
      taskKey: input.taskKey,
      tenantId: agent.id,
    }),
    getLatestTenantScheduledTasksRefreshJob({ tenantId: agent.id }),
  ]);

  return {
    agent,
    latestRefreshJob,
    organization,
    task,
  };
}

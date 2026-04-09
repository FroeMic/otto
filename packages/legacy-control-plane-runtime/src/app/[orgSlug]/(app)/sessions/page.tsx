import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "../../_lib/organization-context";
import {
  getConversationNameMap,
  getMemberNameMap,
  getUserExternalIds,
  listTenantSessions,
} from "../../../../db/control-plane";
import { getCronSessionTaskKeyMap } from "../../../../db/scheduled-tasks";
import { resolveDateTimePreferences } from "../../../../lib/date-time";
import { getPrimaryAgent, isOrganizationUnlocked } from "../../../../lib/workspace";

import { SessionsContent } from "./_components/sessions-content";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization, user } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const agent = getPrimaryAgent(organization);
  const [
    sessions,
    currentUserExternalIds,
    conversationNameMap,
    memberNameMap,
    cronTaskKeyMap,
  ] = await Promise.all([
    agent ? listTenantSessions({ tenantId: agent.id }) : [],
    getUserExternalIds({
      userExternalId: user.id,
      organizationId: organization.id,
    }),
    getConversationNameMap({ organizationId: organization.id }),
    getMemberNameMap({ organizationId: organization.id }),
    agent ? getCronSessionTaskKeyMap({ tenantId: agent.id }) : new Map(),
  ]);

  const channelNames = Object.fromEntries(conversationNameMap);
  const memberNames = Object.fromEntries(memberNameMap);
  const cronTaskKeys = Object.fromEntries(cronTaskKeyMap);
  const dateTimePreferences = resolveDateTimePreferences({
    locale: organization.locale,
    timeFormatPreference: organization.timeFormatPreference,
    timeZone: organization.timezone,
  });

  return (
    <SessionsContent
      dateTimePreferences={dateTimePreferences}
      orgSlug={organization.slug}
      sessions={sessions}
      currentUserExternalIds={currentUserExternalIds}
      isPlatformAdmin={user.isPlatformAdmin}
      channelNames={channelNames}
      memberNames={memberNames}
      cronTaskKeys={cronTaskKeys}
    />
  );
}

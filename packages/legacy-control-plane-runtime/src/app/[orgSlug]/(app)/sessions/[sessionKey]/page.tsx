import { notFound, redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "../../../_lib/organization-context";
import {
  getConversationNameMap,
  getMemberNameMap,
  getTenantSession,
  getUserExternalIds,
} from "../../../../../db/control-plane";
import { getTenantScheduledTask } from "../../../../../db/scheduled-tasks";
import { resolveDateTimePreferences } from "../../../../../lib/date-time";
import { getPrimaryAgent, isOrganizationUnlocked } from "../../../../../lib/workspace";

import {
  canViewSessionDetail,
  formatSessionName,
} from "../_lib/session-display";
import { TranscriptViewer } from "./_components/transcript-viewer";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; sessionKey: string }>;
}) {
  const { orgSlug, sessionKey } = await params;
  const { currentOrganization: organization, user } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const agent = getPrimaryAgent(organization);
  if (!agent) {
    notFound();
  }

  const decodedKey = decodeURIComponent(sessionKey);
  const [session, currentUserExternalIds, memberNameMap, channelNameMap] =
    await Promise.all([
      getTenantSession({
        tenantId: agent.id,
        sessionKey: decodedKey,
      }),
      getUserExternalIds({
        userExternalId: user.id,
        organizationId: organization.id,
      }),
      getMemberNameMap({ organizationId: organization.id }),
      getConversationNameMap({ organizationId: organization.id }),
    ]);

  if (!session) {
    notFound();
  }

  const canView = canViewSessionDetail({
    sessionKey: decodedKey,
    currentUserExternalIds,
    isPlatformAdmin: user.isPlatformAdmin,
    sessionOriginFrom: session.originFrom,
  });

  if (!canView) {
    notFound();
  }

  // Check if this is a cron session and the scheduled task still exists
  const cronJobIdMatch = /^agent:[^:]+:cron:([^:]+)/.exec(decodedKey);
  let cronJobHref: string | null = null;
  if (cronJobIdMatch) {
    const task = await getTenantScheduledTask({
      tenantId: agent.id,
      taskKey: cronJobIdMatch[1],
    });
    if (task) {
      cronJobHref = `/${organization.slug}/scheduled-tasks/tasks/${encodeURIComponent(cronJobIdMatch[1])}/overview`;
    }
  }

  const channelNames = Object.fromEntries(channelNameMap);
  const memberNames = Object.fromEntries(memberNameMap);

  const sessionName = formatSessionName({
    sessionKey: decodedKey,
    displayName: session.displayName,
    label: session.label,
    subject: session.subject,
    originFrom: session.originFrom,
    chatType: session.chatType,
    nameMaps: {
      channels: channelNameMap,
      members: memberNameMap,
    },
  });
  const dateTimePreferences = resolveDateTimePreferences({
    locale: organization.locale,
    timeFormatPreference: organization.timeFormatPreference,
    timeZone: organization.timezone,
  });

  return (
    <TranscriptViewer
      dateTimePreferences={dateTimePreferences}
      orgSlug={organization.slug}
      session={session}
      sessionName={sessionName}
      cronJobHref={cronJobHref}
      currentUserExternalIds={currentUserExternalIds}
      memberNames={memberNames}
      channelNames={channelNames}
    />
  );
}

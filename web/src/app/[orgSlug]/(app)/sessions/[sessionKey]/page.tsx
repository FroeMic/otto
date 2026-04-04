import { notFound, redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  getConversationNameMap,
  getMemberNameMap,
  getTenantSession,
  getUserExternalIds,
} from "@/db/control-plane";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

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

  return (
    <TranscriptViewer
      orgSlug={organization.slug}
      session={session}
      sessionName={sessionName}
      currentUserExternalIds={currentUserExternalIds}
      memberNames={memberNames}
      channelNames={channelNames}
    />
  );
}

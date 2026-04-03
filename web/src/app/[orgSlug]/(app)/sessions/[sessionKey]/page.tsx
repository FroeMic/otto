import { notFound, redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { getTenantSession, getUserExternalIds } from "@/db/control-plane";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

import { canViewSessionDetail } from "../_lib/session-display";
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
  const [session, currentUserExternalIds] = await Promise.all([
    getTenantSession({
      tenantId: agent.id,
      sessionKey: decodedKey,
    }),
    getUserExternalIds({
      userExternalId: user.id,
      organizationId: organization.id,
    }),
  ]);

  if (!session) {
    notFound();
  }

  // Enforce DM access control: only session owner or platform admins
  const canView = canViewSessionDetail({
    sessionKey: decodedKey,
    currentUserExternalIds,
    isPlatformAdmin: user.isPlatformAdmin,
    sessionOriginFrom: session.originFrom,
  });

  if (!canView) {
    notFound();
  }

  return (
    <TranscriptViewer
      orgSlug={organization.slug}
      session={session}
      currentUserExternalIds={currentUserExternalIds}
    />
  );
}

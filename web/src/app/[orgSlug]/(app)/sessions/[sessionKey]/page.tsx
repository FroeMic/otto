import { notFound, redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { getTenantSession } from "@/db/control-plane";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

import { TranscriptViewer } from "./_components/transcript-viewer";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; sessionKey: string }>;
}) {
  const { orgSlug, sessionKey } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const agent = getPrimaryAgent(organization);
  if (!agent) {
    notFound();
  }

  const decodedKey = decodeURIComponent(sessionKey);
  const session = await getTenantSession({
    tenantId: agent.id,
    sessionKey: decodedKey,
  });

  if (!session) {
    notFound();
  }

  return (
    <TranscriptViewer
      orgSlug={organization.slug}
      session={session}
    />
  );
}

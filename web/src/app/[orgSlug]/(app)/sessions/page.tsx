import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { listTenantSessions } from "@/db/control-plane";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

import { SessionsContent } from "./_components/sessions-content";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
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
  const sessions = agent
    ? await listTenantSessions({ tenantId: agent.id })
    : [];

  return (
    <SessionsContent
      orgSlug={organization.slug}
      sessions={sessions}
    />
  );
}

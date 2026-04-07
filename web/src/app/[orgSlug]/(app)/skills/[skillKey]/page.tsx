import { notFound, redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { ManagedSkillPanel } from "@/app/[orgSlug]/(app)/skills/_components/managed-skill-panel";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; skillKey: string }>;
}) {
  const { orgSlug, skillKey } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const primaryAgent = getPrimaryAgent(organization);

  if (!primaryAgent) {
    notFound();
  }

  return (
    <ManagedSkillPanel
      orgSlug={organization.slug}
      skillKey={skillKey}
      tenantId={primaryAgent.id}
    />
  );
}

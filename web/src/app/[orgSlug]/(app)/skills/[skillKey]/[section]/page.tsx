import { notFound, redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { ManagedSkillPanel } from "@/app/[orgSlug]/(app)/skills/_components/managed-skill-panel";
import { isManagedSkillSection } from "@/lib/managed-skills/routing";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SkillDetailSectionPage({
  params,
}: {
  params: Promise<{ orgSlug: string; section: string; skillKey: string }>;
}) {
  const { orgSlug, section, skillKey } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  if (!isManagedSkillSection(section)) {
    notFound();
  }

  const primaryAgent = getPrimaryAgent(organization);

  if (!primaryAgent) {
    notFound();
  }

  return (
    <ManagedSkillPanel
      orgSlug={organization.slug}
      section={section}
      skillKey={skillKey}
      tenantId={primaryAgent.id}
    />
  );
}

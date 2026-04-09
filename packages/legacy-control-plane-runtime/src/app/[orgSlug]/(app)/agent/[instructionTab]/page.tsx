import { notFound, redirect } from "next/navigation";
import { ManagedInstructionsPanel } from "../../../_components/managed-instructions-panel";
import { loadOrganizationRouteContext } from "../../../_lib/organization-context";
import { getAgentInstructionTabBySlug } from "../_lib/agent-instruction-tabs";
import { isOrganizationUnlocked } from "../../../../../lib/workspace";

export const dynamic = "force-dynamic";

export default async function AgentInstructionPage({
  params,
}: {
  params: Promise<{ instructionTab: string; orgSlug: string }>;
}) {
  const { instructionTab, orgSlug } = await params;
  const selectedTab = getAgentInstructionTabBySlug(instructionTab);

  if (!selectedTab) {
    notFound();
  }

  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  return (
    <ManagedInstructionsPanel
      instructionTabSlug={selectedTab.slug}
      organization={organization}
      orgSlug={orgSlug}
      selectedFilePath={selectedTab.actualPath}
    />
  );
}

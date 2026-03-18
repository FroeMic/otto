import { redirect } from "next/navigation";

import { ManagedInstructionsPanel } from "@/app/[orgSlug]/_components/managed-instructions-panel";
import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AgentPromptsPage({
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

  return (
    <ManagedInstructionsPanel organization={organization} orgSlug={orgSlug} />
  );
}

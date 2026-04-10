import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { WorkspaceFilesContent } from "@/app/[orgSlug]/(app)/files/_components/workspace-files-content";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceFilesPage({
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

  const primaryAgent = getPrimaryAgent(organization);

  if (!primaryAgent) {
    redirect(`/${organization.slug}/onboarding`);
  }

  return <WorkspaceFilesContent orgSlug={organization.slug} />;
}

import { notFound, redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { getIntegrationDefinition } from "@/integrations/framework";
import { isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function IntegrationDetailSectionPage({
  params,
}: {
  params: Promise<{ integrationKey: string; orgSlug: string; section: string }>;
}) {
  const { integrationKey, orgSlug, section } = await params;
  const { currentOrganization: organization, user } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const definition = getIntegrationDefinition(integrationKey);
  const DetailPage = definition?.ui?.loadDetailPage
    ? await definition.ui.loadDetailPage()
    : null;

  if (!definition || !DetailPage) {
    notFound();
  }

  return (
    <DetailPage
      orgSlug={organization.slug}
      section={section}
      userExternalId={user.id}
    />
  );
}

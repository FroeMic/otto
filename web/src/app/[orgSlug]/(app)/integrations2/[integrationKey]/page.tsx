import { notFound, redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { getIntegrationDefinition } from "@/integrations/framework";
import { isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function Integration2DetailPage({
  params,
}: {
  params: Promise<{ integrationKey: string; orgSlug: string }>;
}) {
  const { integrationKey, orgSlug } = await params;
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

  return <DetailPage orgSlug={organization.slug} userExternalId={user.id} />;
}

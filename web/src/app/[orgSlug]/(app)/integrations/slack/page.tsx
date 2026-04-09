import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { SlackManagedIntegrationPage } from "@/integrations/library/slack/ui/page";

export const dynamic = "force-dynamic";

export default async function SlackIntegrationPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { user } = await loadOrganizationRouteContext(orgSlug);

  return (
    <SlackManagedIntegrationPage orgSlug={orgSlug} userExternalId={user.id} />
  );
}

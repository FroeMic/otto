import { notFound, redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  type CapabilityInventoryRow,
  CapabilityInventoryTable,
} from "@/app/[orgSlug]/(app)/capabilities2/_components/capability-inventory-table";
import { listManagedIntegrationCapabilitiesForOrganization } from "@/db/control-plane";
import { getIntegrationDefinition } from "@/integrations/framework";
import { isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function IntegrationCapabilitiesPage({
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

  if (!definition?.runtimeSurface) {
    notFound();
  }

  const rows = (
    await listManagedIntegrationCapabilitiesForOrganization({
      orgSlug,
      providerKey: definition.key,
      userExternalId: user.id,
    })
  ).map(
    (row): CapabilityInventoryRow => ({
      ...row,
      policyEndpoint: `/api/integrations/${orgSlug}/${definition.key}/capabilities/${encodeURIComponent(row.capabilityKey)}/policy`,
      reason: row.capabilityState.reason ?? null,
      searchText: [
        row.label,
        row.description,
        row.commandKey,
        row.capabilityState.reason ?? "",
      ]
        .join(" ")
        .toLowerCase(),
      status: row.capabilityState.status,
    }),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {definition.label} capabilities
        </h1>
        <p className="text-sm text-muted-foreground">
          Review which commands Otto can use for {definition.label} in this
          workspace and block individual capabilities when needed.
        </p>
      </div>
      <CapabilityInventoryTable rows={rows} showSource={false} />
    </div>
  );
}

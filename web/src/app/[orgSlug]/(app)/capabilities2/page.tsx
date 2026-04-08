import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  type CapabilityInventoryRow,
  CapabilityInventoryTable,
} from "@/app/[orgSlug]/(app)/capabilities2/_components/capability-inventory-table";
import { listWorkspaceManagedIntegrationCapabilities } from "@/db/control-plane";
import { isOrganizationUnlocked } from "@/lib/workspace";
import { baseAgentCapabilities } from "@/tools/base-capabilities";

export const dynamic = "force-dynamic";

function buildCoreCapabilityRows(orgSlug: string): CapabilityInventoryRow[] {
  return baseAgentCapabilities
    .map((capability) => ({
      capabilityKey: capability.key,
      capabilityType:
        capability.direction === "trigger"
          ? ("trigger" as const)
          : ("command" as const),
      description: capability.description,
      effect:
        capability.direction === "trigger"
          ? null
          : capability.direction === "read"
            ? ("read" as const)
            : ("write" as const),
      label: capability.label,
      policy: null,
      policyEndpoint: null,
      reason: null,
      searchText: [capability.label, capability.description, "Otto core"]
        .join(" ")
        .toLowerCase(),
      sourceHref: `/${orgSlug}/capabilities2`,
      sourceIcon: null,
      sourceLabel: "Otto core",
      sourceType: "core" as const,
      status: "enabled" as const,
      userControllable: false,
    }))
    .sort((left, right) => {
      if (left.capabilityType !== right.capabilityType) {
        return left.capabilityType === "trigger" ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    });
}

export default async function Capabilities2Page({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization, user } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const [integrationRows, coreRows] = await Promise.all([
    listWorkspaceManagedIntegrationCapabilities({
      orgSlug,
      userExternalId: user.id,
    }),
    Promise.resolve(buildCoreCapabilityRows(orgSlug)),
  ]);

  const rows: CapabilityInventoryRow[] = [
    ...integrationRows.map(
      (row): CapabilityInventoryRow => ({
        ...row,
        policyEndpoint: `/api/integrations/${orgSlug}/${row.sourceKey}/capabilities/${encodeURIComponent(row.capabilityKey)}/policy`,
        reason: row.capabilityState.reason ?? null,
        searchText: [
          row.label,
          row.description,
          row.commandKey,
          row.sourceLabel,
          row.capabilityState.reason ?? "",
        ]
          .join(" ")
          .toLowerCase(),
        status: row.capabilityState.status,
      }),
    ),
    ...coreRows,
  ].sort((left, right) => {
    if (left.capabilityType !== right.capabilityType) {
      return left.capabilityType === "trigger" ? -1 : 1;
    }

    if (left.sourceLabel !== right.sourceLabel) {
      return left.sourceLabel.localeCompare(right.sourceLabel);
    }

    return left.label.localeCompare(right.label);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Capabilities</h1>
        <p className="text-sm text-muted-foreground">
          Review what Otto can do across installed integrations and Otto core
          tools.
        </p>
      </div>
      <CapabilityInventoryTable rows={rows} />
    </div>
  );
}

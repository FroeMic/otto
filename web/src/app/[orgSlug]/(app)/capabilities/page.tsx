import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  CapabilitiesTable,
  type CapabilityRow,
} from "@/app/[orgSlug]/(app)/capabilities/_components/capabilities-table";
import { listTenantToolConfigSurfaces } from "@/db/control-plane";
import { isOrganizationUnlocked } from "@/lib/workspace";
import { baseAgentCapabilities } from "@/tools/base-capabilities";

export const dynamic = "force-dynamic";

export default async function CapabilitiesPage({
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

  const surfaces = await listTenantToolConfigSurfaces({
    orgSlug,
    userExternalId: user.id,
  });

  const rows: CapabilityRow[] = [];

  // Base capabilities
  for (const cap of baseAgentCapabilities) {
    rows.push({ ...cap, sourceLabel: "Native" });
  }

  // Capabilities from connected surfaces
  for (const surface of surfaces) {
    if (!surface.agentCapabilities) continue;
    for (const cap of surface.agentCapabilities) {
      rows.push({ ...cap, sourceLabel: surface.label });
    }
  }

  return <CapabilitiesTable rows={rows} />;
}

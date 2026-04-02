import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { CapabilitiesContent } from "@/app/[orgSlug]/(app)/capabilities/_components/capabilities-content";
import { listTenantToolConfigSurfaces } from "@/db/control-plane";
import { isOrganizationUnlocked } from "@/lib/workspace";
import { baseAgentCapabilities } from "@/tools/base-capabilities";
import type { AgentCapability } from "@/tools/types";

export const dynamic = "force-dynamic";

type CapabilityGroup = {
  capabilities: AgentCapability[];
  key: string;
  label: string;
};

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

  const groups: CapabilityGroup[] = [];

  // Base capabilities (always available)
  groups.push({
    capabilities: baseAgentCapabilities,
    key: "base",
    label: "Native",
  });

  // Capabilities from each installed surface
  for (const surface of surfaces) {
    if (
      !surface.agentCapabilities ||
      surface.agentCapabilities.length === 0
    ) {
      continue;
    }
    groups.push({
      capabilities: surface.agentCapabilities,
      key: surface.key,
      label: surface.label,
    });
  }

  return <CapabilitiesContent groups={groups} />;
}

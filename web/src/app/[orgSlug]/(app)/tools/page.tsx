import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import type { CapabilitySummary } from "@/app/[orgSlug]/(app)/integrations/_components/integrations-content";
import { ToolsContent } from "@/app/[orgSlug]/(app)/tools/_components/tools-content";
import { listTenantToolConfigSurfaces } from "@/db/control-plane";
import { isOrganizationUnlocked } from "@/lib/workspace";
import type { AgentCapability } from "@/tools/types";

function computeCapabilitySummary(
  capabilities?: AgentCapability[],
): CapabilitySummary | undefined {
  if (!capabilities || capabilities.length === 0) return undefined;
  return {
    reads: capabilities.filter((c) => c.direction === "read").length,
    tools: capabilities.filter((c) => c.direction === "tool").length,
    triggers: capabilities.filter((c) => c.direction === "trigger").length,
  };
}

export const dynamic = "force-dynamic";

export default async function ToolsPage({
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

  const entries = surfaces
    .filter((surface) => surface.uiGroup === "tools")
    .map((surface) => ({
      availability: surface.availability,
      capabilitySummary: computeCapabilitySummary(surface.agentCapabilities),
      description: surface.description,
      enabled: surface.config.enabled,
      id: surface.id,
      installState: surface.config.installState,
      key: surface.key,
      kind: surface.kind,
      label: surface.label,
      settingsUrl: surface.settingsUrl,
      surfaceType: surface.surfaceType,
      uiGroup: surface.uiGroup,
    }));

  return <ToolsContent orgSlug={organization.slug} surfaces={entries} />;
}

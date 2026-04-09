import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import type {
  CapabilitySummary,
  SurfaceEntry,
} from "@/app/[orgSlug]/(app)/integrations/_components/integrations-content";
import { IntegrationsContent } from "@/app/[orgSlug]/(app)/integrations/_components/integrations-content";
import { listTenantToolConfigSurfaces } from "@/db/control-plane";
import type { AgentCapability } from "@/lib/agent-capabilities";
import { isOrganizationUnlocked } from "@/lib/workspace";

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

const knownIntegrations: SurfaceEntry[] = [];

export default async function IntegrationsPage({
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

  // Build entries from live surfaces (integrations only)
  const liveSurfacesByKey = new Map<string, SurfaceEntry>();
  for (const surface of surfaces) {
    if (surface.uiGroup !== "integrations") continue;
    liveSurfacesByKey.set(surface.key, {
      availability: surface.availability,
      capabilitySummary: computeCapabilitySummary(surface.agentCapabilities),
      categoryLabel:
        surface.key === "slack" ? "Messaging" : "Product Management",
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
    });
  }

  // Merge: use live data when available, fall back to known static entry
  const entries = knownIntegrations.map((known) => {
    const live = liveSurfacesByKey.get(known.key);
    if (live) return live;
    return {
      ...known,
      capabilitySummary: undefined,
      settingsUrl: `/${organization.slug}/integrations2/${known.key}/status`,
    };
  });

  return <IntegrationsContent orgSlug={organization.slug} surfaces={entries} />;
}

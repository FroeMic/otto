import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import type {
  CapabilitySummary,
  SurfaceEntry,
} from "@/app/[orgSlug]/(app)/integrations/_components/integrations-content";
import { IntegrationsContent } from "@/app/[orgSlug]/(app)/integrations/_components/integrations-content";
import { listTenantToolConfigSurfaces } from "@/db/control-plane";
import { WHATSAPP_RUNTIME_CONFIG_DESCRIPTION } from "@/lib/whatsapp-config";
import { isOrganizationUnlocked } from "@/lib/workspace";
import { getToolDefinition } from "@/tools";
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

/**
 * Legacy integration page entries that still live on the runtime-config-backed
 * surface until they move onto the registry-driven integrations2 shape.
 */
const knownIntegrations: SurfaceEntry[] = [
  {
    categoryLabel: "Messaging",
    description: WHATSAPP_RUNTIME_CONFIG_DESCRIPTION,
    enabled: false,
    id: "known:channel:whatsapp",
    installState: "uninstalled",
    key: "whatsapp",
    kind: "channel",
    label: "WhatsApp",
    settingsUrl: null,
    surfaceType: "integration",
    uiGroup: "integrations",
  },
];

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
        surface.key === "slack" || surface.key === "whatsapp"
          ? "Messaging"
          : "Product Management",
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
    // Look up capabilities from the tool definition registry
    const definition = getToolDefinition(known.kind, known.key);
    return {
      ...known,
      capabilitySummary: computeCapabilitySummary(
        definition?.agentCapabilities,
      ),
      settingsUrl: `/${organization.slug}/integrations/${known.key}`,
    };
  });

  return <IntegrationsContent orgSlug={organization.slug} surfaces={entries} />;
}

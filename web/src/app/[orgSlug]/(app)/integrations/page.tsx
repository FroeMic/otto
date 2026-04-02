import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { IntegrationsContent } from "@/app/[orgSlug]/(app)/integrations/_components/integrations-content";
import { listTenantToolConfigSurfaces } from "@/db/control-plane";
import { SLACK_RUNTIME_CONFIG_DESCRIPTION } from "@/lib/slack-config";
import { WHATSAPP_RUNTIME_CONFIG_DESCRIPTION } from "@/lib/whatsapp-config";
import { isOrganizationUnlocked } from "@/lib/workspace";
import type { SurfaceEntry } from "@/app/[orgSlug]/(app)/integrations/_components/integrations-content";

export const dynamic = "force-dynamic";

/**
 * Static registry of known integrations that should always appear,
 * even when the tenant has not connected them yet.
 */
const knownIntegrations: SurfaceEntry[] = [
  {
    description: SLACK_RUNTIME_CONFIG_DESCRIPTION,
    enabled: false,
    id: "known:channel:slack",
    installState: "uninstalled",
    key: "slack",
    kind: "channel",
    label: "Slack",
    settingsUrl: null,
    surfaceType: "integration",
    uiGroup: "integrations",
  },
  {
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
      settingsUrl: `/${organization.slug}/integrations/${known.key}`,
    };
  });

  return (
    <IntegrationsContent orgSlug={organization.slug} surfaces={entries} />
  );
}

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

const brandIconMap: Record<string, string> = {
  slack: "/integrations/slack.svg",
  whatsapp: "/integrations/whatsapp.png",
  "web-search": "/integrations/web-search.svg",
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

  const rows: CapabilityRow[] = [];

  // Base capabilities
  for (const cap of baseAgentCapabilities) {
    rows.push({ ...cap, sourceLabel: "Native" });
  }

  // Capabilities from connected surfaces
  for (const surface of surfaces) {
    if (!surface.agentCapabilities) continue;

    const href =
      surface.settingsUrl ??
      (surface.uiGroup === "integrations"
        ? `/${organization.slug}/integrations/${surface.key}`
        : `/${organization.slug}/tools/${surface.kind}/${surface.key}`);

    for (const cap of surface.agentCapabilities) {
      rows.push({
        ...cap,
        sourceHref: href,
        sourceIcon: brandIconMap[surface.key] ?? null,
        sourceLabel: surface.label,
      });
    }
  }

  return <CapabilitiesTable rows={rows} />;
}

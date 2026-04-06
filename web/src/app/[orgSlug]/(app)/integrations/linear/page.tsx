import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { LinearIntegrationPanel } from "@/app/[orgSlug]/(app)/integrations/linear/_components/linear-integration-panel";
import { getTenantManagedIntegrationSummary } from "@/db/control-plane";
import { getManagedIntegrationDefinition } from "@/lib/managed-integrations/catalog";
import { isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type LinearIntegrationUiState =
  | "connected"
  | "disabled"
  | "disconnected"
  | "needs_attention";

function getUiState(input: {
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  lastError: string | null;
  status: string | null;
}): LinearIntegrationUiState {
  if (input.lastError || input.status === "error") {
    return "needs_attention";
  }

  if (input.status === "disabled") {
    return "disabled";
  }

  if (
    input.connectedAt &&
    !input.disconnectedAt &&
    input.status === "connected"
  ) {
    return "connected";
  }

  return "disconnected";
}

function getStatusLabel(state: LinearIntegrationUiState) {
  switch (state) {
    case "connected":
      return "Connected";
    case "disabled":
      return "Disabled";
    case "needs_attention":
      return "Needs attention";
    case "disconnected":
      return "Not connected";
  }
}

export default async function LinearIntegrationPage({
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

  const definition = getManagedIntegrationDefinition("linear");

  if (!definition) {
    throw new Error("Managed integration definition for Linear is missing.");
  }

  const summary = await getTenantManagedIntegrationSummary({
    orgSlug,
    providerKey: definition.key,
    userExternalId: user.id,
  });
  const uiState = getUiState({
    connectedAt: summary?.connectedAt ?? null,
    disconnectedAt: summary?.disconnectedAt ?? null,
    lastError: summary?.lastError ?? null,
    status: summary?.status ?? null,
  });

  return (
    <LinearIntegrationPanel
      agentCapabilities={definition.agentCapabilities}
      iconSrc={definition.iconSrc}
      orgSlug={orgSlug}
      pageDescription={definition.pageDescription}
      statusLabel={getStatusLabel(uiState)}
      summary={
        summary
          ? {
              connectedAt: summary.connectedAt?.toISOString() ?? null,
              lastError: summary.lastError,
              lastErrorAt: summary.lastErrorAt?.toISOString() ?? null,
              status: summary.status,
            }
          : null
      }
      uiState={uiState}
    />
  );
}

import type { CapabilityInventoryRow } from "@/app/[orgSlug]/(app)/capabilities2/_components/capability-inventory-table";
import {
  getTenantManagedIntegrationSummary,
  listManagedIntegrationCapabilitiesForOrganization,
} from "@/db/control-plane";
import { getIntegrationDefinition } from "@/integrations/framework";
import { hasLinearOAuthConfig } from "@/lib/env";
import { LinearIntegrationPanel } from "./components/integration-panel";

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

function getConnectActionLabel(state: LinearIntegrationUiState) {
  if (state === "connected" || state === "needs_attention") {
    return "Reconnect Linear";
  }

  return "Connect Linear";
}

export async function LinearIntegrationPage({
  orgSlug,
  userExternalId,
}: {
  orgSlug: string;
  userExternalId: string;
}) {
  const definition = getIntegrationDefinition("linear");

  if (!definition) {
    throw new Error("Integration definition for Linear is missing.");
  }

  const summary = await getTenantManagedIntegrationSummary({
    orgSlug,
    providerKey: definition.key,
    userExternalId,
  });
  const capabilityRows = (
    await listManagedIntegrationCapabilitiesForOrganization({
      orgSlug,
      providerKey: definition.key,
      userExternalId,
    })
  ).map(
    (row): CapabilityInventoryRow => ({
      ...row,
      policyEndpoint: `/api/integrations/${orgSlug}/${definition.key}/capabilities/${encodeURIComponent(row.capabilityKey)}/policy`,
      reason: row.capabilityState.reason ?? null,
      searchText: [
        row.label,
        row.description,
        row.commandGroup ?? "",
        row.commandKey,
        row.capabilityState.reason ?? "",
      ]
        .join(" ")
        .toLowerCase(),
      status: row.capabilityState.status,
    }),
  );
  const uiState = getUiState({
    connectedAt: summary?.connectedAt ?? null,
    disconnectedAt: summary?.disconnectedAt ?? null,
    lastError: summary?.lastError ?? null,
    status: summary?.status ?? null,
  });

  return (
    <LinearIntegrationPanel
      agentCapabilities={definition.agentCapabilities}
      canConnect={hasLinearOAuthConfig()}
      capabilityRows={capabilityRows}
      connectActionLabel={getConnectActionLabel(uiState)}
      connectUrl={`/oauth/start/integration/linear?orgSlug=${encodeURIComponent(orgSlug)}`}
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

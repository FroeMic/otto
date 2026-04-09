import type { IntegrationDefinition, RuntimeIntegrationStatus } from "./types";

type RuntimeIntegrationStatusRow = {
  connectedAt: Date | null;
  connectionStatus: string | null;
  disconnectedAt: Date | null;
  integrationStatus: string | null;
  tenantIntegrationId: string;
};

export function getIntegrationManagementMode(
  definition: Pick<IntegrationDefinition, "managementMode">,
) {
  return definition.managementMode ?? "workspace_managed";
}

export function isPlatformManagedIntegration(
  definition: Pick<IntegrationDefinition, "managementMode">,
) {
  return getIntegrationManagementMode(definition) === "platform_managed";
}

export function resolvePlatformManagedIntegrationStatus(
  definition: Pick<IntegrationDefinition, "managementMode" | "resolveStatus">,
): RuntimeIntegrationStatus | null {
  if (!isPlatformManagedIntegration(definition)) {
    return null;
  }

  return (
    definition.resolveStatus?.() ?? {
      connected: true,
      connectionStatus: "managed",
      enabled: true,
      integrationStatus: "connected",
      needsAttention: false,
    }
  );
}

export function resolveRuntimeIntegrationStatus(input: {
  definition: Pick<IntegrationDefinition, "managementMode" | "resolveStatus">;
  row: RuntimeIntegrationStatusRow | null;
}) {
  if (input.row) {
    const connected = Boolean(
      input.row.connectedAt && !input.row.disconnectedAt,
    );
    const integrationStatus = input.row.integrationStatus ?? null;
    const connectionStatus = input.row.connectionStatus ?? null;

    return {
      installed: true,
      status: {
        connected,
        connectionStatus,
        enabled: connected,
        integrationStatus,
        needsAttention:
          integrationStatus === "error" ||
          integrationStatus === "needs_attention" ||
          connectionStatus === "needs_attention",
      } satisfies RuntimeIntegrationStatus,
      tenantIntegrationId: input.row.tenantIntegrationId,
    };
  }

  const platformManagedStatus = resolvePlatformManagedIntegrationStatus(
    input.definition,
  );

  if (platformManagedStatus) {
    return {
      installed: true,
      status: platformManagedStatus,
      tenantIntegrationId: null,
    };
  }

  return {
    installed: false,
    status: {
      connected: false,
      connectionStatus: null,
      enabled: false,
      integrationStatus: null,
      needsAttention: false,
    } satisfies RuntimeIntegrationStatus,
    tenantIntegrationId: null,
  };
}

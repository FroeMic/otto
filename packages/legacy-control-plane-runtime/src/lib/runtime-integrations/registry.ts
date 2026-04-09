import type {
  IntegrationCommandDefinition as RuntimeIntegrationManifestCommand,
  RuntimeIntegrationManifestEntry,
} from "../../integrations/framework";
import {
  buildRuntimeIntegrationManifestForKeys,
  executeRegisteredIntegrationCommand,
  getIntegrationDefinition,
  listSupportedRuntimeIntegrationKeys,
} from "../../integrations/framework";

export {
  buildRuntimeIntegrationManifestForKeys,
  listSupportedRuntimeIntegrationKeys,
};
export type {
  RuntimeIntegrationManifestCommand,
  RuntimeIntegrationManifestEntry,
};

export async function executeRuntimeIntegrationStub(input: {
  arguments: Record<string, unknown>;
  commandKey: string;
  integrationKey: string;
}) {
  const integration = getIntegrationDefinition(input.integrationKey);

  if (!integration?.runtimeSurface) {
    throw new Error(`Unsupported managed integration: ${input.integrationKey}`);
  }

  if (integration.oauth) {
    return {
      arguments: input.arguments,
      commandKey: input.commandKey,
      integrationKey: integration.key,
      message: `${integration.label} requires an authenticated execution context.`,
      source: "stub",
    };
  }

  return executeRegisteredIntegrationCommand({
    arguments: input.arguments,
    commandKey: input.commandKey,
    integrationKey: input.integrationKey,
    tenantIntegrationId: null,
  });
}

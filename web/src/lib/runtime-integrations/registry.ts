import type {
  RuntimeIntegrationManifestEntry,
  IntegrationOperationDefinition as RuntimeIntegrationManifestOperation,
} from "@/integrations/framework";
import {
  buildRuntimeIntegrationManifestForKeys,
  getIntegrationDefinition,
  listSupportedRuntimeIntegrationKeys,
} from "@/integrations/framework";
import { validateOperationParameters } from "@/integrations/framework/validation";

export {
  buildRuntimeIntegrationManifestForKeys,
  listSupportedRuntimeIntegrationKeys,
};
export type {
  RuntimeIntegrationManifestEntry,
  RuntimeIntegrationManifestOperation,
};

export async function executeRuntimeIntegrationStub(input: {
  integrationKey: string;
  params: Record<string, unknown>;
}) {
  const integration = getIntegrationDefinition(input.integrationKey);
  const operationKey =
    typeof input.params.operation === "string" ? input.params.operation : "";

  if (!integration?.runtimeTool) {
    throw new Error(`Unsupported managed integration: ${input.integrationKey}`);
  }

  const operation = integration.runtimeTool.operations.find(
    (entry) => entry.key === operationKey,
  );

  if (!operation) {
    throw new Error(
      `${integration.key} does not support the ${operationKey || "requested"} operation.`,
    );
  }

  validateOperationParameters(operation, input.params);

  if (integration.oauth) {
    return {
      integrationKey: integration.key,
      message: `${integration.label} requires an authenticated execution context.`,
      operation:
        typeof input.params.operation === "string"
          ? input.params.operation
          : "unknown",
      query:
        typeof input.params.query === "string"
          ? input.params.query.trim().toLowerCase()
          : "",
      source: "stub",
      totalMatched: 0,
    };
  }

  const validatedParams = operation.validate
    ? operation.validate(input.params)
    : input.params;

  return operation.execute({
    context: {
      auth: null,
      tenantIntegrationId: null,
    },
    params: validatedParams,
  });
}

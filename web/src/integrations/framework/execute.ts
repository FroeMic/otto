import {
  getConnectedOauthAccessForTenantIntegration,
  recordOauthConnectionAttention,
} from "@/db/oauth";

import { getIntegrationDefinition } from "./registry";
import { validateOperationParameters } from "./validation";

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The provider request failed.";
}

export async function executeRegisteredIntegrationFunction(input: {
  integrationKey: string;
  params: Record<string, unknown>;
  tenantIntegrationId: string | null;
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

  const validatedParams = operation.validate
    ? operation.validate(input.params)
    : input.params;

  let auth = null;

  if (integration.oauth) {
    if (!input.tenantIntegrationId) {
      throw new Error(
        `${integration.label} is not connected in this workspace.`,
      );
    }

    auth = await getConnectedOauthAccessForTenantIntegration({
      providerKey: integration.oauth.provider.key,
      tenantIntegrationId: input.tenantIntegrationId,
    });

    if (!auth || auth.status !== "connected") {
      throw new Error(
        `${integration.label} needs attention. Reconnect ${integration.label} in your workspace.`,
      );
    }
  }

  try {
    return await operation.execute({
      context: {
        auth,
        tenantIntegrationId: input.tenantIntegrationId,
      },
      params: validatedParams,
    });
  } catch (error) {
    if (!integration.oauth || !auth) {
      throw error;
    }

    const errorMessage = getUnknownErrorMessage(error);
    const classifiedKind = integration.oauth.provider.classifyError(error);

    if (classifiedKind === "reauthorize") {
      console.warn(
        `[runtime-integrations] ${integration.key} request needs reauthorize tenantIntegration=${input.tenantIntegrationId ?? "missing"} operation=${typeof input.params.operation === "string" ? input.params.operation : "unknown"} error=${errorMessage}`,
      );
      await recordOauthConnectionAttention({
        connectionId: auth.connectionId,
        errorMessage,
        eventType: "request_failed_reauthorize",
        providerKey: integration.oauth.provider.key,
        tenantIntegrationId: auth.tenantIntegrationId,
      });

      throw new Error(
        `${integration.label} needs attention. Reconnect ${integration.label} in your workspace.`,
      );
    }

    console.error(
      `[runtime-integrations] ${integration.key} request failed tenantIntegration=${input.tenantIntegrationId ?? "missing"} operation=${typeof input.params.operation === "string" ? input.params.operation : "unknown"} kind=${classifiedKind} error=${errorMessage}`,
    );
    throw error;
  }
}

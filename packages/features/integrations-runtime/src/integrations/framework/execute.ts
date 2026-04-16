import {
  getConnectedOauthAccessForTenantIntegration,
  recordOauthConnectionAttention,
} from "../../db/oauth";
import {
  getConnectedApiCredentialForTenantIntegration,
  recordApiCredentialAttention,
} from "../../db/api-credentials";

import { getIntegrationDefinition } from "./registry";
import { collectCommands } from "./search";
import type { IntegrationAuthBinding, IntegrationDefinition } from "./types";
import { validateCommandArguments } from "./validation";

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The provider request failed.";
}

function getCommandKey(input: {
  commandKey?: string | null;
  commandPath?: string[] | null;
}) {
  const commandKey = input.commandKey?.trim();

  if (commandKey) {
    return commandKey;
  }

  if (Array.isArray(input.commandPath) && input.commandPath.length > 0) {
    const parts = input.commandPath
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);

    if (parts.length > 0) {
      return parts.join(".");
    }
  }

  return "";
}

function getIntegrationAuthBinding(
  integration: IntegrationDefinition,
): IntegrationAuthBinding | null {
  if (integration.auth) {
    return integration.auth;
  }

  if (integration.oauth) {
    return {
      kind: "oauth",
      provider: integration.oauth.provider,
    };
  }

  return null;
}

function getMissingScopes(input: {
  declaredScopes: string[];
  requiredScopes: string[];
}) {
  const declaredScopes = new Set(input.declaredScopes);

  return input.requiredScopes.filter((scope) => !declaredScopes.has(scope));
}

export async function executeRegisteredIntegrationCommand(input: {
  arguments: Record<string, unknown>;
  commandKey?: string | null;
  commandPath?: string[] | null;
  integrationKey: string;
  tenantIntegrationId: string | null;
}) {
  const integration = getIntegrationDefinition(input.integrationKey);
  const commandKey = getCommandKey({
    commandKey: input.commandKey,
    commandPath: input.commandPath,
  });

  if (!integration?.runtimeSurface) {
    throw new Error(`Unsupported managed integration: ${input.integrationKey}`);
  }

  const command = collectCommands(integration.runtimeSurface).find(
    (entry) => entry.commandKey === commandKey,
  );

  if (!command) {
    throw new Error(
      `${integration.key} does not support the ${commandKey || "requested"} command.`,
    );
  }

  validateCommandArguments(command, input.arguments);

  const validatedArguments = command.validate
    ? command.validate(input.arguments)
    : input.arguments;

  let auth = null;
  const authBinding = getIntegrationAuthBinding(integration);

  if (authBinding?.kind === "oauth") {
    if (!input.tenantIntegrationId) {
      throw new Error(
        `${integration.label} is not connected in this workspace.`,
      );
    }

    const oauthAuth = await getConnectedOauthAccessForTenantIntegration({
      providerKey: authBinding.provider.key,
      tenantIntegrationId: input.tenantIntegrationId,
    });

    if (!oauthAuth || oauthAuth.status !== "connected") {
      throw new Error(
        `${integration.label} needs attention. Reconnect ${integration.label} in your workspace.`,
      );
    }

    auth = {
      ...oauthAuth,
      apiKey: undefined as never,
      kind: "oauth" as const,
    };
  }

  if (authBinding?.kind === "api_key") {
    if (!input.tenantIntegrationId) {
      throw new Error(
        `${integration.label} is not connected in this workspace.`,
      );
    }

    const apiCredential = await getConnectedApiCredentialForTenantIntegration({
      providerKey: integration.key,
      tenantIntegrationId: input.tenantIntegrationId,
    });

    if (!apiCredential || apiCredential.status !== "connected") {
      throw new Error(
        `${integration.label} needs attention. Reconnect ${integration.label} in your workspace.`,
      );
    }

    const missingScopes = getMissingScopes({
      declaredScopes: apiCredential.declaredScopes,
      requiredScopes: command.requiredProviderScopes ?? [],
    });

    if (missingScopes.length > 0) {
      throw new Error(
        `${command.commandKey} requires the ${missingScopes.join(", ")} ${integration.label} scope${missingScopes.length === 1 ? "" : "s"}.`,
      );
    }

    auth = {
      ...apiCredential,
      accessToken: undefined as never,
      kind: "api_key" as const,
    };
  }

  try {
    return await command.execute({
      arguments: validatedArguments,
      context: {
        auth,
        tenantIntegrationId: input.tenantIntegrationId,
      },
    });
  } catch (error) {
    if (!authBinding || !auth) {
      throw error;
    }

    const errorMessage = getUnknownErrorMessage(error);
    const classifiedKind =
      authBinding.kind === "oauth"
        ? authBinding.provider.classifyError(error)
        : "reauthorize";

    if (classifiedKind === "reauthorize") {
      console.warn(
        `[runtime-integrations] ${integration.key} request needs reauthorize tenantIntegration=${input.tenantIntegrationId ?? "missing"} command=${commandKey || "unknown"} error=${errorMessage}`,
      );
      if (authBinding.kind === "oauth" && auth.kind === "oauth") {
        await recordOauthConnectionAttention({
          connectionId: auth.connectionId,
          errorMessage,
          eventType: "request_failed_reauthorize",
          providerKey: authBinding.provider.key,
          tenantIntegrationId: auth.tenantIntegrationId,
        });
      }

      if (authBinding.kind === "api_key" && auth.kind === "api_key") {
        await recordApiCredentialAttention({
          credentialId: auth.credentialId,
          errorMessage,
        });
      }

      throw new Error(
        `${integration.label} needs attention. Reconnect ${integration.label} in your workspace.`,
      );
    }

    console.error(
      `[runtime-integrations] ${integration.key} request failed tenantIntegration=${input.tenantIntegrationId ?? "missing"} command=${commandKey || "unknown"} kind=${classifiedKind} error=${errorMessage}`,
    );
    throw error;
  }
}

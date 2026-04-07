import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import { recordIntegrationExecutionAudit } from "@/db/integration-execution-audits";
import { tenantIntegrations } from "@/db/schema";
import {
  executeRegisteredIntegrationCommand,
  getIntegrationDefinition,
  listSupportedRuntimeIntegrationKeys,
} from "@/integrations/framework";

async function getEnabledManagedRuntimeIntegrationKeysForTenant(input: {
  tenantId: string;
}) {
  const supportedProviderKeys = listSupportedRuntimeIntegrationKeys();

  if (supportedProviderKeys.length === 0) {
    return [];
  }

  const db = getDb();
  const rows = await db
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      disconnectedAt: tenantIntegrations.disconnectedAt,
      providerKey: tenantIntegrations.providerKey,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        inArray(tenantIntegrations.providerKey, supportedProviderKeys),
      ),
    );

  return rows
    .filter((row) => row.connectedAt && !row.disconnectedAt)
    .map((row) => row.providerKey)
    .sort((left, right) => left.localeCompare(right));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Managed integration execution failed";
}

function resolveCommandKey(input: {
  commandKey?: string;
  commandPath?: string[];
}) {
  if (input.commandKey?.trim()) {
    return input.commandKey.trim();
  }

  if (Array.isArray(input.commandPath) && input.commandPath.length > 0) {
    return input.commandPath
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(".");
  }

  return "unknown";
}

export async function executeRuntimeIntegrationInGateway(input: {
  arguments: Record<string, unknown>;
  commandKey?: string;
  commandPath?: string[];
  integrationKey: string;
  tenantId: string;
}) {
  const integrationKey = input.integrationKey.trim().toLowerCase();
  const commandKey = resolveCommandKey({
    commandKey: input.commandKey,
    commandPath: input.commandPath,
  });

  let tenantIntegrationId: string | null = null;

  try {
    const definition = getIntegrationDefinition(integrationKey);

    if (!definition?.runtimeSurface) {
      throw new Error(
        `Managed integration ${input.integrationKey} is not registered.`,
      );
    }

    const providerKeys = await getEnabledManagedRuntimeIntegrationKeysForTenant(
      {
        tenantId: input.tenantId,
      },
    );

    if (!providerKeys.includes(integrationKey)) {
      throw new Error(
        `Managed integration ${input.integrationKey} is not enabled for this tenant.`,
      );
    }

    if (definition.oauth) {
      const db = getDb();
      const [integration] = await db
        .select({
          id: tenantIntegrations.id,
        })
        .from(tenantIntegrations)
        .where(
          and(
            eq(tenantIntegrations.tenantId, input.tenantId),
            eq(tenantIntegrations.providerKey, integrationKey),
          ),
        )
        .limit(1);

      if (!integration) {
        throw new Error(
          `${definition.label} is not connected in this workspace.`,
        );
      }

      tenantIntegrationId = integration.id;
    }

    const result = await executeRegisteredIntegrationCommand({
      arguments: input.arguments,
      commandKey: input.commandKey,
      commandPath: input.commandPath,
      integrationKey,
      tenantIntegrationId,
    });

    await recordIntegrationExecutionAudit({
      commandKey,
      integrationKey,
      request: {
        arguments: input.arguments,
        ...(input.commandKey ? { commandKey: input.commandKey } : {}),
        ...(input.commandPath ? { commandPath: input.commandPath } : {}),
      },
      response: result,
      status: "succeeded",
      tenantId: input.tenantId,
      tenantIntegrationId,
    });

    return result;
  } catch (error) {
    await recordIntegrationExecutionAudit({
      commandKey,
      errorMessage: getErrorMessage(error),
      integrationKey,
      request: {
        arguments: input.arguments,
        ...(input.commandKey ? { commandKey: input.commandKey } : {}),
        ...(input.commandPath ? { commandPath: input.commandPath } : {}),
      },
      status: "failed",
      tenantId: input.tenantId,
      tenantIntegrationId,
    });

    throw error;
  }
}

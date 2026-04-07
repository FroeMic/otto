import { getDb } from "@/db/client";
import { integrationExecutionAudits } from "@/db/schema";

function normalizeJsonValue(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {
    value,
  };
}

export async function recordIntegrationExecutionAudit(input: {
  errorMessage?: string | null;
  integrationKey: string;
  operationKey: string;
  request: Record<string, unknown>;
  response?: unknown;
  status: "failed" | "succeeded";
  tenantId: string;
  tenantIntegrationId: string | null;
}) {
  const db = getDb();

  await db.insert(integrationExecutionAudits).values({
    errorMessage: input.errorMessage ?? null,
    integrationKey: input.integrationKey,
    operationKey: input.operationKey,
    requestJson: normalizeJsonValue(input.request) ?? {},
    responseJson: normalizeJsonValue(input.response),
    status: input.status,
    tenantId: input.tenantId,
    tenantIntegrationId: input.tenantIntegrationId,
  });
}

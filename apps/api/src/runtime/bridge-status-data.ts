import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { tenantRuntimeBridgeStatuses } from "@otto/feature-integrations-runtime/db/schema"
import { eq } from "drizzle-orm"

import type { TenantRuntimeBridgeStatusReport } from "./bridge-status"

export async function upsertTenantRuntimeBridgeStatus(input: {
  report: TenantRuntimeBridgeStatusReport
  tenantId: string
}) {
  const db = getDb()
  const now = new Date()
  const normalizedInstalledPluginIds = [...new Set(input.report.runtime.installedPluginIds)]
    .sort((left, right) => left.localeCompare(right))
  const normalizedEnabledPluginIds = [...new Set(input.report.runtime.enabledPluginIds)]
    .sort((left, right) => left.localeCompare(right))

  const [status] = await db
    .insert(tenantRuntimeBridgeStatuses)
    .values({
      bridgeId: input.report.bridgeId,
      bridgeStatus: "online",
      controlPlaneBaseUrl: input.report.runtime.controlPlaneBaseUrl ?? null,
      enabledPluginIds: normalizedEnabledPluginIds,
      gatewayHealthy: input.report.gateway.healthy,
      gatewayPort: input.report.gateway.port ?? null,
      gatewayStatusCode: input.report.gateway.statusCode ?? null,
      installedPluginIds: normalizedInstalledPluginIds,
      lastReportedAt: now,
      sessionReporterEnabled: input.report.runtime.sessionReporterEnabled,
      tenantId: input.tenantId,
      workspaceChatEnabled: input.report.runtime.workspaceChatEnabled,
    })
    .onConflictDoUpdate({
      set: {
        bridgeId: input.report.bridgeId,
        bridgeStatus: "online",
        controlPlaneBaseUrl: input.report.runtime.controlPlaneBaseUrl ?? undefined,
        enabledPluginIds: normalizedEnabledPluginIds,
        gatewayHealthy: input.report.gateway.healthy,
        gatewayPort: input.report.gateway.port ?? undefined,
        gatewayStatusCode: input.report.gateway.statusCode ?? undefined,
        installedPluginIds: normalizedInstalledPluginIds,
        lastReportedAt: now,
        sessionReporterEnabled: input.report.runtime.sessionReporterEnabled,
        updatedAt: now,
        workspaceChatEnabled: input.report.runtime.workspaceChatEnabled,
      },
      target: tenantRuntimeBridgeStatuses.tenantId,
    })
    .returning({
      bridgeId: tenantRuntimeBridgeStatuses.bridgeId,
      status: tenantRuntimeBridgeStatuses.bridgeStatus,
      tenantId: tenantRuntimeBridgeStatuses.tenantId,
    })

  if (!status) {
    throw new Error("Failed to persist tenant runtime bridge status.")
  }

  return status
}

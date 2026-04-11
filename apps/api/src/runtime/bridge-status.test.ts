import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  createTenantRuntimeBridgeStatusRouter,
  type TenantRuntimeBridgeStatusRouteDependencies,
} from "./bridge-status"

function createDependencies(): TenantRuntimeBridgeStatusRouteDependencies {
  return {
    authenticateTenantRuntime: async () => ({
      tenantId: "tenant_1",
    }),
    recordBridgeStatus: async ({ report, tenantId }) => ({
      bridgeId: report.bridgeId,
      status: "online",
      tenantId,
    }),
  }
}

describe("tenant runtime bridge status routes", () => {
  it("accepts a bridge status report from a tenant runtime", async () => {
    const app = createTenantRuntimeBridgeStatusRouter(createDependencies())

    const response = await app.request(
      "http://api.local/api/internal/runtime/bridge/report",
      {
        body: JSON.stringify({
          bridgeId: "bridge-1",
          gateway: {
            healthy: true,
            port: 18791,
            statusCode: 200,
          },
          runtime: {
            controlPlaneBaseUrl: "https://getyourotto.com",
            enabledPluginIds: ["otto-session-reporter", "otto-workspace-chat"],
            installedPluginIds: ["otto-session-reporter", "otto-workspace-chat"],
            sessionReporterEnabled: true,
            workspaceChatEnabled: true,
          },
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      bridgeId: "bridge-1",
      ok: true,
      status: "online",
      tenantId: "tenant_1",
    })
  })

  it("rejects malformed bridge reports", async () => {
    const app = createTenantRuntimeBridgeStatusRouter(createDependencies())

    const response = await app.request(
      "http://api.local/api/internal/runtime/bridge/report",
      {
        body: JSON.stringify({
          bridgeId: "",
          gateway: {
            healthy: "yes",
          },
          runtime: {
            enabledPluginIds: [],
            installedPluginIds: [],
            sessionReporterEnabled: true,
            workspaceChatEnabled: true,
          },
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: "Invalid tenant runtime bridge payload",
      issues: [
        {
          code: "too_small",
          inclusive: true,
          minimum: 1,
          origin: "string",
          path: ["bridgeId"],
          message: "Too small: expected string to have >=1 characters",
        },
        {
          expected: "boolean",
          code: "invalid_type",
          path: ["gateway", "healthy"],
          message: "Invalid input: expected boolean, received string",
        },
      ],
    })
  })
})

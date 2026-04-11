import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  createTenantRuntimeBridgeCommandsRouter,
  type TenantRuntimeBridgeCommandsRouteDependencies,
} from "./bridge-commands"

function createDependencies(): TenantRuntimeBridgeCommandsRouteDependencies {
  return {
    authenticateTenantRuntime: async () => ({
      tenantId: "tenant_1",
    }),
    claimNextCommand: async ({ bridgeId, tenantId }) => ({
      command: {
        commandId: "cmd_1",
        commandType: "conversation.trigger_message",
        payload: {
          conversationId: "conv_1",
          message: "Summarize the latest notes.",
        },
      },
      tenantId,
    }),
    completeCommand: async ({ commandId, result, tenantId }) => ({
      commandId,
      status: result.status,
      tenantId,
    }),
  }
}

describe("tenant runtime bridge command routes", () => {
  it("claims the next queued bridge command for a tenant runtime", async () => {
    const app = createTenantRuntimeBridgeCommandsRouter(createDependencies())

    const response = await app.request(
      "http://api.local/api/internal/runtime/bridge/commands/claim",
      {
        body: JSON.stringify({
          bridgeId: "runtime-bridge:tenant-1",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      command: {
        commandId: "cmd_1",
        commandType: "conversation.trigger_message",
        payload: {
          conversationId: "conv_1",
          message: "Summarize the latest notes.",
        },
      },
      ok: true,
      tenantId: "tenant_1",
    })
  })

  it("returns an empty claim result when no bridge command is queued", async () => {
    const app = createTenantRuntimeBridgeCommandsRouter({
      ...createDependencies(),
      claimNextCommand: async ({ tenantId }) => ({
        command: null,
        tenantId,
      }),
    })

    const response = await app.request(
      "http://api.local/api/internal/runtime/bridge/commands/claim",
      {
        body: JSON.stringify({
          bridgeId: "runtime-bridge:tenant-1",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      command: null,
      ok: true,
      tenantId: "tenant_1",
    })
  })

  it("accepts command completion reports from the tenant bridge", async () => {
    const app = createTenantRuntimeBridgeCommandsRouter(createDependencies())

    const response = await app.request(
      "http://api.local/api/internal/runtime/bridge/commands/cmd_1/complete",
      {
        body: JSON.stringify({
          result: {
            completedAt: "2026-04-11T16:00:00.000Z",
            status: "succeeded",
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
      commandId: "cmd_1",
      ok: true,
      status: "succeeded",
      tenantId: "tenant_1",
    })
  })
})

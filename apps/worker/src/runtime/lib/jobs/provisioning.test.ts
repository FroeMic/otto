import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { __testing } from "./provisioning"

describe("provisioning desired state reconciliation", () => {
  it("uses the reconciled desired state when code defaults changed before bootstrap", async () => {
    const resolved = await __testing.reconcileDesiredStateForProvisioning({
      ensureCurrentTenantDesiredStateVersion: async () => ({
        changed: true,
        configJson: {
          media: {
            audio: {
              enabled: true,
              model: "gpt-4o-mini-transcribe",
              provider: "openai",
            },
          },
        },
        version: 4,
      }),
      getLatestTenantDesiredState: async () => ({
        configJson: {
          ottoPlugins: [{ id: "otto-workspace-chat" }],
        },
        version: 3,
      }),
      tenantId: "tenant_1",
    })

    assert.equal(resolved.changed, true)
    assert.equal(resolved.previousDesiredStateVersion, 3)
    assert.equal(resolved.desiredState.version, 4)
    assert.deepEqual(resolved.desiredState.configJson, {
      media: {
        audio: {
          enabled: true,
          model: "gpt-4o-mini-transcribe",
          provider: "openai",
        },
      },
    })
  })
})

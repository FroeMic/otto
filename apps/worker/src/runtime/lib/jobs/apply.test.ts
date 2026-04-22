import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { __testing } from "./apply"

describe("apply tenant config desired state reconciliation", () => {
  it("uses the reconciled desired state version when code defaults changed", async () => {
    const resolved = await __testing.reconcileDesiredStateForApply({
      ensureCurrentTenantDesiredStateVersion: async () => ({
        changed: true,
        configJson: {
          media: {
            audio: {
              attachmentsMode: "all",
            },
          },
        },
        version: 13,
      }),
      payloadDesiredStateVersion: 12,
      tenantId: "tenant_1",
    })

    assert.equal(resolved.changed, true)
    assert.equal(resolved.payloadDesiredStateVersion, 12)
    assert.equal(resolved.desiredState.version, 13)
    assert.deepEqual(resolved.desiredState.configJson, {
      media: {
        audio: {
          attachmentsMode: "all",
        },
      },
    })
  })

  it("keeps the existing desired state version when reconciliation is unchanged", async () => {
    const resolved = await __testing.reconcileDesiredStateForApply({
      ensureCurrentTenantDesiredStateVersion: async () => ({
        changed: false,
        configJson: {
          media: {
            audio: {
              attachmentsMode: "all",
            },
          },
        },
        version: 12,
      }),
      payloadDesiredStateVersion: 12,
      tenantId: "tenant_1",
    })

    assert.equal(resolved.changed, false)
    assert.equal(resolved.desiredState.version, 12)
  })
})

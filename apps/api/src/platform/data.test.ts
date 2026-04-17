import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  buildPlatformInitialProvisioningCreditGrantInput,
  buildPlatformProvisioningJobInput,
} from "./data"

describe("platform provisioning helpers", () => {
  it("builds the same base-image tenant server contract as onboarding", () => {
    const result = buildPlatformProvisioningJobInput({
      provisioningStrategy: "legacy_base_image",
      tenantId: "tenant_123",
    })

    assert.deepEqual(result, {
      jobType: "provision_tenant_server",
      payloadJson: {
        step: "create_server",
        tenantId: "tenant_123",
      },
      tenantServer: {
        provider: "hetzner",
        provisioningStrategy: "legacy_base_image",
        sshUsername: "openclaw",
        status: "creating",
      },
    })
  })

  it("uses the onboarding initial-credit grant contract for manual platform provisioning", () => {
    assert.deepEqual(
      buildPlatformInitialProvisioningCreditGrantInput({
        tenantId: "tenant_123",
      }),
      {
        billableUnits: 0,
        creditsDeltaMilli: 1_000_000,
        description: "Initial workspace credits (1000 credits)",
        entryType: "manual_grant",
        sourceId: "tenant_123",
        sourceType: "workspace_initial_grant",
        tenantId: "tenant_123",
      },
    )
  })
})

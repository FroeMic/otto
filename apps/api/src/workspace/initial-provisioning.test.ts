import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  buildInitialWorkspaceRuntimeProvisioningJobInput,
  buildPlatformWorkspaceOnboardingProvisioningInsert,
  buildWorkspaceOnboardingProvisioningPatch,
} from "./initial-provisioning"

describe("initial workspace runtime provisioning", () => {
  it("builds the shared base-image tenant server job contract", () => {
    const result = buildInitialWorkspaceRuntimeProvisioningJobInput({
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

  it("marks an onboarding run as provisioning once runtime provisioning starts", () => {
    const now = new Date("2026-04-18T19:41:35.647Z")

    assert.deepEqual(
      buildWorkspaceOnboardingProvisioningPatch({
        jobId: "job_123",
        now,
        tenantId: "tenant_123",
      }),
      {
        currentStepKey: null,
        initialProvisioningJobId: "job_123",
        initialTenantId: "tenant_123",
        provisioningStartedAt: now,
        status: "provisioning",
        updatedAt: now,
      },
    )
  })

  it("creates platform-origin onboarding runs in the provisioning state", () => {
    const now = new Date("2026-04-18T19:41:35.647Z")

    assert.deepEqual(
      buildPlatformWorkspaceOnboardingProvisioningInsert({
        jobId: "job_123",
        now,
        organizationId: "org_123",
        starterPrompt: null,
        tenantId: "tenant_123",
        userId: "user_123",
      }),
      {
        answersJson: {},
        currentStepKey: null,
        flowKey: "workspace_onboarding",
        flowVersion: 1,
        initialProvisioningJobId: "job_123",
        initialTenantId: "tenant_123",
        organizationId: "org_123",
        provisioningStartedAt: now,
        starterPrompt: "",
        status: "provisioning",
        updatedAt: now,
        userId: "user_123",
        waitlistDecision: "accepted",
      },
    )
  })
})

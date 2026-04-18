import assert from "node:assert/strict"
import { beforeEach, describe, it, vi } from "vitest"

const connectedTenantIntegration = {
  connectedAt: new Date("2026-04-18T12:00:00.000Z"),
  disconnectedAt: null,
  id: "tenant-integration-1",
  integrationStatus: "connected",
}

const executeRegisteredIntegrationCommand = vi.fn()
const recordIntegrationExecutionAudit = vi.fn()

vi.mock("../db/client", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [connectedTenantIntegration],
        }),
      }),
    }),
  }),
}))

vi.mock("../db/integration-capability-policies", () => ({
  getTenantIntegrationCapabilityPolicy: async () => null,
}))

vi.mock("../db/integration-execution-audits", () => ({
  recordIntegrationExecutionAudit: (...args: unknown[]) =>
    recordIntegrationExecutionAudit(...args),
}))

vi.mock("../integrations/framework", () => ({
  collectCommands: () => [
    {
      commandKey: "workspace.list_projects",
      label: "List projects",
    },
  ],
  executeRegisteredIntegrationCommand: (...args: unknown[]) =>
    executeRegisteredIntegrationCommand(...args),
  getIntegrationDefinition: () => ({
    auth: {
      credentialType: "personal_api_key",
      kind: "api_key",
    },
    key: "posthog",
    label: "PostHog",
    runtimeSurface: {
      commandGroups: [],
    },
  }),
  resolveCommandCapabilityState: () => ({ status: "enabled" }),
}))

describe("executeRuntimeIntegrationInGateway", () => {
  beforeEach(() => {
    executeRegisteredIntegrationCommand.mockReset()
    recordIntegrationExecutionAudit.mockReset()
  })

  it("passes connected API-key integration ids into command execution", async () => {
    executeRegisteredIntegrationCommand.mockResolvedValueOnce({
      ok: true,
    })
    const { executeRuntimeIntegrationInGateway } = await import("./execute")

    await executeRuntimeIntegrationInGateway({
      arguments: {},
      commandKey: "workspace.list_projects",
      integrationKey: "posthog",
      tenantId: "tenant-1",
    })

    assert.equal(
      executeRegisteredIntegrationCommand.mock.calls[0]?.[0]
        .tenantIntegrationId,
      "tenant-integration-1",
    )
  })
})

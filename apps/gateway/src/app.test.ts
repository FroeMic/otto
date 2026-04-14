import assert from "node:assert/strict"

import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateTenantRuntimeRequest = vi.fn()
const executeRuntimeIntegrationInGateway = vi.fn()

vi.mock("@otto/feature-integrations-runtime", async () => {
  const actual = await vi.importActual<typeof import("@otto/feature-integrations-runtime")>(
    "@otto/feature-integrations-runtime",
  )

  return {
    ...actual,
    authenticateTenantRuntimeRequest,
    executeRuntimeIntegrationInGateway,
  }
})

const { createGatewayApp } = await import("./app")

describe("gateway app", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns service health", async () => {
    const app = createGatewayApp()
    const response = await app.request("http://gateway.local/healthz")

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "gateway",
    })
  })

  it("rejects execute requests without runtime auth", async () => {
    const app = createGatewayApp()
    const response = await app.request(
      "http://gateway.local/api/internal/runtime/integrations/execute",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          arguments: {},
          commandKey: "slack.send_message",
          integrationKey: "slack",
        }),
      },
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: "Missing runtime bearer token",
    })
  })

  it("executes a Gandi command through the runtime gateway path", async () => {
    authenticateTenantRuntimeRequest.mockResolvedValue({
      tenantId: "tenant_123",
    })
    executeRuntimeIntegrationInGateway.mockResolvedValue({
      domains: [
        {
          availability: "available",
          currentPhase: "golive",
          domain: "ledgerpilot.ai",
          prices: [],
          status: "available",
        },
      ],
    })

    const app = createGatewayApp()
    const response = await app.request(
      "http://gateway.local/api/internal/runtime/integrations/execute",
      {
        method: "POST",
        headers: {
          authorization: "Bearer runtime_token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          arguments: {
            domains: ["ledgerpilot.ai"],
          },
          commandKey: "domain.batch_check",
          integrationKey: "gandi",
        }),
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      domains: [
        {
          availability: "available",
          currentPhase: "golive",
          domain: "ledgerpilot.ai",
          prices: [],
          status: "available",
        },
      ],
    })
    expect(authenticateTenantRuntimeRequest).toHaveBeenCalledTimes(1)
    expect(executeRuntimeIntegrationInGateway).toHaveBeenCalledWith({
      arguments: {
        domains: ["ledgerpilot.ai"],
      },
      commandKey: "domain.batch_check",
      commandPath: undefined,
      integrationKey: "gandi",
      tenantId: "tenant_123",
    })
  })
})

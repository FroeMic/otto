import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  authenticateTenantRuntimeRequest,
  getBearerTokenFromRequest,
  isRuntimeAuthError,
  RuntimeAuthError,
} from "./index"

describe("runtime auth helpers", () => {
  it("reads a bearer token from the request", () => {
    const token = getBearerTokenFromRequest(
      new Request("https://otto.test", {
        headers: {
          authorization: "Bearer tenant-secret",
        },
      }),
    )

    assert.equal(token, "tenant-secret")
  })

  it("throws a typed runtime auth error when the token is missing", () => {
    try {
      getBearerTokenFromRequest(new Request("https://otto.test"))
      assert.fail("expected getBearerTokenFromRequest to throw")
    } catch (error) {
      assert.equal(isRuntimeAuthError(error), true)
      assert.equal(
        error instanceof RuntimeAuthError ? error.message : "",
        "Missing runtime bearer token",
      )
    }
  })

  it("authenticates a tenant through an injected token lookup", async () => {
    const tenant = await authenticateTenantRuntimeRequest({
      getTenantByTenantToken: async (tenantToken) =>
        tenantToken === "tenant-secret" ? { tenantId: "tenant_123" } : null,
      request: new Request("https://otto.test", {
        headers: {
          authorization: "Bearer tenant-secret",
        },
      }),
      resolveTenantId: (value) => value.tenantId,
    })

    assert.deepEqual(tenant, { tenantId: "tenant_123" })
  })
})

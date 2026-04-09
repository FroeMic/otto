import assert from "node:assert/strict"

import { sealData } from "iron-session"
import { describe, it } from "vitest"

import {
  authenticateTenantRuntimeRequest,
  authenticateWorkspaceSessionRequest,
  getBearerTokenFromRequest,
  isRuntimeAuthError,
  isWorkspaceSessionAuthError,
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

  it("reads a WorkOS workspace session cookie", async () => {
    const cookiePassword = "a".repeat(32)
    const sessionCookie = await sealData(
      {
        accessToken: "token",
        refreshToken: "refresh",
        user: {
          email: "test@getyourotto.com",
          firstName: "Test",
          id: "user_123",
          lastName: "User",
        },
      },
      {
        password: cookiePassword,
      },
    )

    const user = await authenticateWorkspaceSessionRequest({
      cookiePassword,
      request: new Request("https://otto.test", {
        headers: {
          cookie: `wos-session=${encodeURIComponent(sessionCookie)}`,
        },
      }),
    })

    assert.deepEqual(user, {
      email: "test@getyourotto.com",
      firstName: "Test",
      id: "user_123",
      lastName: "User",
    })
  })

  it("throws a typed error when the workspace session cookie is missing", async () => {
    try {
      await authenticateWorkspaceSessionRequest({
        cookiePassword: "a".repeat(32),
        request: new Request("https://otto.test"),
      })
      assert.fail("expected authenticateWorkspaceSessionRequest to throw")
    } catch (error) {
      assert.equal(isWorkspaceSessionAuthError(error), true)
      assert.equal(
        error instanceof Error ? error.message : "",
        "Missing workspace session",
      )
    }
  })
})

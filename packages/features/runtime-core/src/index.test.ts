import assert from "node:assert/strict"

import { RuntimeAuthError } from "@otto/auth"
import { describe, it } from "vitest"

import {
  handleManagedConfigGetRequest,
  handleManagedConfigPatchRequest,
} from "./index"

function isNeverManagedConfigVersionConflict(_error: unknown): _error is never {
  return false
}

describe("runtime core managed config handlers", () => {
  it("returns unauthorized when runtime auth fails", async () => {
    const response = await handleManagedConfigGetRequest({
      authenticateTenantRuntimeRequest: async () => {
        throw new RuntimeAuthError(
          "missing_runtime_bearer_token",
          "Missing runtime bearer token",
        )
      },
      getLatestTenantManagedConfig: async () => ({
        files: [],
        version: 1,
      }),
      normalizeManagedBootstrapFilePath: (filePath) => filePath,
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-config",
      ),
    })

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: "Missing runtime bearer token",
    })
  })

  it("returns a managed config file when a valid filePath is requested", async () => {
    const response = await handleManagedConfigGetRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      getLatestTenantManagedConfig: async () => ({
        files: [{ path: "config/openclaw.json", contentText: "{}" }],
        version: 7,
      }),
      normalizeManagedBootstrapFilePath: (filePath) => filePath,
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-config?filePath=config/openclaw.json",
      ),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      file: { path: "config/openclaw.json", contentText: "{}" },
      version: 7,
    })
  })

  it("validates managed config patch payloads", async () => {
    const response = await handleManagedConfigPatchRequest({
      authenticateTenantRuntimeRequest: async () => ({
        tenantId: "tenant_123",
      }),
      isVersionConflictError: isNeverManagedConfigVersionConflict,
      normalizeManagedBootstrapFilePath: (filePath) => filePath,
      request: new Request(
        "https://otto.test/api/internal/runtime/managed-config",
        {
          method: "PATCH",
          body: JSON.stringify({
            filePath: "config/openclaw.json",
            sharedContent: "next",
          }),
          headers: {
            "content-type": "application/json",
          },
        },
      ),
      updateTenantManagedFileSharedContentForTenant: async (payload) => payload,
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      createdByExternalId: null,
      createdByType: "runtime",
      filePath: "config/openclaw.json",
      sharedContent: "next",
      summary:
        "Runtime updated shared managed config block for config/openclaw.json",
      tenantId: "tenant_123",
    })
  })
})

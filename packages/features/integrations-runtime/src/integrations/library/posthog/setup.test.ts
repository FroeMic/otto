import assert from "node:assert/strict"
import { afterEach, describe, it, vi } from "vitest"

import { discoverPostHogIntegrationSetup } from "./setup"

describe("PostHog integration setup", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("discovers projects and probes access scopes", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const requestUrl = String(url)

      if (requestUrl.endsWith("/api/users/@me/")) {
        return jsonResponse({ email: "product@example.com", uuid: "user-1" })
      }

      if (requestUrl.endsWith("/api/organizations/")) {
        return jsonResponse({
          results: [{ id: "org-1", name: "Acme" }],
        })
      }

      if (requestUrl.endsWith("/api/organizations/org-1/projects/")) {
        return jsonResponse({
          results: [
            {
              environment_id: "env-1",
              id: "project-1",
              name: "Product App",
            },
          ],
        })
      }

      if (requestUrl.endsWith("/api/projects/project-1/feature_flags/")) {
        return jsonResponse({ results: [] })
      }

      if (requestUrl.endsWith("/api/environments/env-1/query/")) {
        return jsonResponse({ results: [{ "?column?": 1 }] })
      }

      return jsonResponse({ detail: "missing scope" }, 403)
    })

    const result = await discoverPostHogIntegrationSetup({
      apiKey: "phx_secret",
      host: "https://us.posthog.com",
    })

    assert.equal(result.account?.label, "product@example.com")
    assert.equal(result.resources[0]?.label, "Product App")
    assert.deepEqual(result.credential.detectedScopes, [
      "feature_flag:read",
      "project:read",
      "query:read",
    ])
    assert.equal(
      result.capabilityRecommendations.find(
        (entry) => entry.capabilityKey === "feature_flag.list",
      )?.status,
      "recommended",
    )
    assert.equal(
      result.capabilityRecommendations.find(
        (entry) => entry.capabilityKey === "query.hogql",
      )?.status,
      "sensitive",
    )
    assert.ok(fetch.mock.calls.length > 3)
  })
})

function jsonResponse(payload: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
      },
      status,
    }),
  )
}

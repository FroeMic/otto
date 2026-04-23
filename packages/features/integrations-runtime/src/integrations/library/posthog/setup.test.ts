import assert from "node:assert/strict"
import { afterEach, describe, it, vi } from "vitest"

import { discoverPostHogIntegrationSetup } from "./setup"

describe("PostHog integration setup", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("discovers project environments and infers available Personal API key scopes", async () => {
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
              id: "project-1",
              name: "Product App",
            },
          ],
        })
      }

      if (requestUrl.endsWith("/api/projects/project-1/environments/")) {
        return jsonResponse({
          results: [
            {
              id: "env-1",
              name: "Production",
            },
          ],
        })
      }

      return jsonResponse({ detail: "missing scope" }, 403)
    })

    const result = await discoverPostHogIntegrationSetup({
      apiKey: "phx_secret",
      host: "https://us.posthog.com",
    })

    assert.equal(result.account?.label, "product@example.com")
    assert.equal(result.resources[0]?.label, "Product App / Production")
    assert.equal(result.resources[0]?.type, "environment")
    assert.deepEqual(result.resources[0]?.metadata, {
      environmentId: "env-1",
      environmentLabel: "Production",
      organizationId: "org-1",
      organizationLabel: "Acme",
      projectId: "project-1",
      projectLabel: "Product App",
    })
    assert.deepEqual(result.statePreview.targets, [
      {
        environmentId: "env-1",
        key: "product_app_production_env_1",
        label: "Product App / Production",
        organizationId: "org-1",
        projectId: "project-1",
      },
    ])
    assert.ok(result.credential.detectedScopes.includes("feature_flag:read"))
    assert.ok(result.credential.detectedScopes.includes("project:read"))
    assert.ok(result.credential.detectedScopes.includes("query:read"))
    assert.ok(result.credential.detectedScopes.includes("insight:write"))
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
    assert.equal(
      result.capabilityRecommendations.find(
        (entry) => entry.capabilityKey === "insight.create",
      )?.status,
      "available",
    )
    assert.equal(fetch.mock.calls.length, 4)
  })

  it("falls back to project resources when environments cannot be discovered", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
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
              id: "project-1",
              name: "Product App",
            },
          ],
        })
      }

      if (requestUrl.endsWith("/api/projects/project-1/environments/")) {
        return jsonResponse({ detail: "missing scope" }, 403)
      }

      return jsonResponse({ detail: "unexpected request" }, 500)
    })

    const result = await discoverPostHogIntegrationSetup({
      apiKey: "phx_secret",
      host: "https://us.posthog.com",
    })

    assert.equal(result.resources[0]?.label, "Product App")
    assert.equal(result.resources[0]?.type, "project")
    assert.deepEqual(result.statePreview.targets, [
      {
        environmentId: undefined,
        key: "product_app_project_1",
        label: "Product App",
        organizationId: "org-1",
        projectId: "project-1",
      },
    ])
    assert.match(
      result.warnings.join("\n"),
      /could not discover PostHog environments/,
    )
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

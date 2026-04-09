import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  handleWorkspaceBootstrapRequest,
  handleWorkspaceSettingsUpdateRequest,
  handleWorkspaceUsageRequest,
} from "./index"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

describe("workspace core", () => {
  it("returns workspace bootstrap data", async () => {
    const response = await handleWorkspaceBootstrapRequest({
      getDashboardOrganizations: async () => [
        {
          id: "org_1",
          isReady: true,
          locale: "en",
          name: "Otto",
          slug: "otto",
          timeFormatPreference: "auto",
          timezone: "Europe/Berlin",
        },
      ],
      hasPlatformAdminRole: async () => true,
      orgSlug: "otto",
      syncUserFromSession: async () => undefined,
      user,
    })

    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.currentOrganization.slug, "otto")
    assert.equal(data.user.isPlatformAdmin, true)
  })

  it("returns usage overview", async () => {
    const response = await handleWorkspaceUsageRequest({
      getOrganizationTenantForBilling: async () => ({ id: "tenant_1" }),
      getOrganizationWorkspaceBySlug: async () => ({ id: "org_1" }),
      getTenantProviderUsageOverview: async () => ({
        summary: {
          activeApiKeys: 1,
          activeModels: 1,
          totalCreditsBurnedMilli: 1000,
          totalInputTokens: 10,
          totalOutputTokens: 5,
          totalProviderCostMicros: 123,
          totalRequests: 2,
        },
        timeSeries: [],
        usageByModel: [],
        usageByType: [],
      }),
      orgSlug: "otto",
      request: new Request(
        "https://otto.test/api/workspace/otto/usage?from=2026-01-01T00:00:00.000Z&to=2026-01-31T00:00:00.000Z",
      ),
      syncUserFromSession: async () => undefined,
      user,
    })

    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.summary.totalRequests, 2)
  })

  it("updates workspace settings", async () => {
    const response = await handleWorkspaceSettingsUpdateRequest({
      getOrganizationWorkspaceBySlug: async () => ({
        externalId: "ext_org",
        id: "org_1",
      }),
      orgSlug: "otto",
      renameOrganization: async () => undefined,
      request: new Request("https://otto.test/api/workspace/otto/settings", {
        body: JSON.stringify({
          action: "update-name",
          name: "Otto Next",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
      syncUserFromSession: async () => undefined,
      updateOrganizationSlug: async () => "ok",
      updateWorkspaceDateTimePreferences: async () => ({
        applyQueued: false,
        locale: "en-US",
        timeFormatPreference: "auto",
        timezone: "UTC",
      }),
      user,
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      name: "Otto Next",
    })
  })

  it("updates workspace date and time settings", async () => {
    const response = await handleWorkspaceSettingsUpdateRequest({
      getOrganizationWorkspaceBySlug: async () => ({
        externalId: "ext_org",
        id: "org_1",
      }),
      orgSlug: "otto",
      renameOrganization: async () => undefined,
      request: new Request("https://otto.test/api/workspace/otto/settings", {
        body: JSON.stringify({
          action: "update-timezone",
          timezone: "Europe/Berlin",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
      syncUserFromSession: async () => undefined,
      updateOrganizationSlug: async () => "ok",
      updateWorkspaceDateTimePreferences: async () => ({
        applyQueued: true,
        locale: "en-US",
        timeFormatPreference: "auto",
        timezone: "Europe/Berlin",
      }),
      user,
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      applyQueued: true,
      locale: "en-US",
      timeFormatPreference: "auto",
      timezone: "Europe/Berlin",
    })
  })

  it("returns a conflict when a workspace slug is already taken", async () => {
    const response = await handleWorkspaceSettingsUpdateRequest({
      getOrganizationWorkspaceBySlug: async () => ({
        externalId: "ext_org",
        id: "org_1",
      }),
      orgSlug: "otto",
      renameOrganization: async () => undefined,
      request: new Request("https://otto.test/api/workspace/otto/settings", {
        body: JSON.stringify({
          action: "update-slug",
          slug: "already-used",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
      syncUserFromSession: async () => undefined,
      updateOrganizationSlug: async () => "slug_taken",
      updateWorkspaceDateTimePreferences: async () => ({
        applyQueued: false,
        locale: "en-US",
        timeFormatPreference: "auto",
        timezone: "UTC",
      }),
      user,
    })

    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), {
      code: "slug_taken",
      message: "This URL is already in use",
    })
  })
})

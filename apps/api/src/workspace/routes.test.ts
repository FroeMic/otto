import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import { Hono } from "hono"
import { afterEach, describe, it, vi } from "vitest"

import {
  registerWorkspaceRoutes,
  type WorkspaceRouteDependencies,
} from "./routes"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

function createDependencies(): WorkspaceRouteDependencies {
  return {
    authenticateWorkspaceUser: async () => user,
    getCurrentWorkspace: async () => ({
      id: "org_1",
      isReady: true,
      locale: "en-US",
      name: "Otto",
      slug: "otto",
      timeFormatPreference: "auto",
      timezone: "UTC",
    }),
    getDashboardOrganizations: async () => [
      {
        id: "org_1",
        isReady: true,
        locale: "en-US",
        name: "Otto",
        slug: "otto",
        timeFormatPreference: "auto",
        timezone: "UTC",
      },
    ],
    getOrganizationTenantForBilling: async () => ({ id: "tenant_1" }),
    getOrganizationWorkspaceBySlug: async () => ({
      externalId: "ext_org",
      id: "org_1",
    }),
    getTenantProviderUsageOverview: async () => ({
      summary: {
        activeApiKeys: 1,
        activeModels: 2,
        totalCreditsBurnedMilli: 1000,
        totalInputTokens: 10,
        totalOutputTokens: 5,
        totalProviderCostMicros: 100,
        totalRequests: 2,
      },
      timeSeries: [],
      usageByModel: [],
      usageByType: [],
    }),
    hasPlatformAdminRole: async () => true,
    renameOrganization: async () => undefined,
    syncUserFromSession: async () => undefined,
    updateOrganizationSlug: async () => "ok",
    updateWorkspaceDateTimePreferences: async () => ({
      applyQueued: false,
      locale: "en-US",
      timeFormatPreference: "auto",
      timezone: "UTC",
    }),
  }
}

function createWorkspaceTestApp(
  dependencies: WorkspaceRouteDependencies = createDependencies(),
) {
  const app = new Hono()
  registerWorkspaceRoutes(app, dependencies)

  return app
}

describe("workspace routes", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the shell bootstrap payload", async () => {
    const app = createWorkspaceTestApp()
    const response = await app.request(
      "http://api.local/api/web/bootstrap/otto",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      currentOrganization: {
        id: "org_1",
        isReady: true,
        locale: "en-US",
        name: "Otto",
        slug: "otto",
        timeFormatPreference: "auto",
        timezone: "UTC",
      },
      organizations: [
        {
          id: "org_1",
          isReady: true,
          locale: "en-US",
          name: "Otto",
          slug: "otto",
          timeFormatPreference: "auto",
          timezone: "UTC",
        },
      ],
      user: {
        email: "test@getyourotto.com",
        id: "user_123",
        isPlatformAdmin: true,
        name: "Test User",
      },
    })
  })

  it("falls back to the current workspace when dashboard organization loading fails", async () => {
    const app = createWorkspaceTestApp({
      ...createDependencies(),
      getCurrentWorkspace: async () => ({
        id: "org_1",
        isReady: true,
        locale: "en-US",
        name: "Otto",
        slug: "otto",
        timeFormatPreference: "auto",
        timezone: "UTC",
      }),
      getDashboardOrganizations: async () => {
        throw new Error("projection failed")
      },
      hasPlatformAdminRole: async () => false,
    })
    const response = await app.request(
      "http://api.local/api/web/bootstrap/otto",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      currentOrganization: {
        id: "org_1",
        isReady: true,
        locale: "en-US",
        name: "Otto",
        slug: "otto",
        timeFormatPreference: "auto",
        timezone: "UTC",
      },
      organizations: [
        {
          id: "org_1",
          isReady: true,
          locale: "en-US",
          name: "Otto",
          slug: "otto",
          timeFormatPreference: "auto",
          timezone: "UTC",
        },
      ],
      user: {
        email: "test@getyourotto.com",
        id: "user_123",
        isPlatformAdmin: false,
        name: "Test User",
      },
    })
  })

  it("returns usage through the native workspace route", async () => {
    const app = createWorkspaceTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/usage?from=2026-01-01T00:00:00.000Z&to=2026-01-31T00:00:00.000Z",
    )
    const data = (await response.json()) as {
      summary: {
        totalRequests: number
      }
    }

    assert.equal(response.status, 200)
    assert.equal(data.summary.totalRequests, 2)
  })

  it("updates workspace settings through the native workspace route", async () => {
    const app = createWorkspaceTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/settings",
      {
        body: JSON.stringify({
          action: "update-name",
          name: "Otto Next",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      name: "Otto Next",
    })
  })

  it("returns 401 when the workspace session is missing", async () => {
    const app = createWorkspaceTestApp({
      ...createDependencies(),
      authenticateWorkspaceUser: async () => {
        throw new WorkspaceSessionAuthError(
          "missing_workspace_session",
          "Missing workspace session",
        )
      },
    })
    const response = await app.request(
      "http://api.local/api/web/bootstrap/otto",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Missing workspace session",
    })
  })

  it("logs bootstrap failure details when the route fails", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    const app = createWorkspaceTestApp({
      ...createDependencies(),
      getCurrentWorkspace: async () => {
        throw new Error("workspace lookup query failed")
      },
      getDashboardOrganizations: async () => {
        throw new Error("organization projection refresh failed")
      },
      hasPlatformAdminRole: async () => false,
    })
    const response = await app.request(
      "http://api.local/api/web/bootstrap/otto",
    )

    assert.equal(response.status, 400)
    assert.equal(errorSpy.mock.calls.length, 3)
    assert.deepEqual(errorSpy.mock.calls[0], [
      "[workspace-bootstrap] load_dashboard_organizations",
      new Error("organization projection refresh failed"),
    ])
    assert.deepEqual(errorSpy.mock.calls[1], [
      "[workspace-bootstrap] load_current_workspace",
      new Error("workspace lookup query failed"),
    ])
    assert.equal(errorSpy.mock.calls[2]?.[0], "[workspace-bootstrap] failed")
    assert.deepEqual(errorSpy.mock.calls[2]?.[1], {
      failures: [
        {
          message: "organization projection refresh failed",
          stage: "load_dashboard_organizations",
        },
        {
          message: "workspace lookup query failed",
          stage: "load_current_workspace",
        },
      ],
      orgSlug: "otto",
      userId: "user_123",
    })
  })
})

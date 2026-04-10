import assert from "node:assert/strict"

import { Hono } from "hono"
import { describe, it } from "vitest"

import {
  createPlatformRouter,
  type PlatformRouteDependencies,
} from "./routes"

const user = {
  email: "operator@getyourotto.com",
  firstName: "Platform",
  id: "user_platform_1",
  lastName: "Admin",
}

function createDependencies(): PlatformRouteDependencies {
  return {
    authenticatePlatformUser: async () => user,
    getDashboardOrganizations: async () => [
      {
        id: "org_workspace_1",
        isReady: true,
        locale: "en-US",
        name: "Interaction42",
        slug: "interaction42",
        timeFormatPreference: "auto",
        timezone: "UTC",
      },
    ],
    getJobStatus: async () => ({
      error: null,
      finishedAt: null,
      ok: true,
      status: "running",
    }),
    getPlatformOrganizationDetail: async () => ({
      configuredRuntimeImage: "ghcr.io/froemic/openclaw:2026.4.8",
      configuredRuntimeImageVersion: "2026.4.8",
      id: "org_1",
      isReady: true,
      locale: "en-US",
      name: "Interaction42",
      observedRuntimeImage: "ghcr.io/froemic/openclaw:2026.4.8",
      observedRuntimeImageVersion: "2026.4.8",
      slackIntegration: null,
      slug: "interaction42",
      tenant: {
        id: "tenant_1",
        ipv4: "203.0.113.10",
        latestApplyRun: null,
        latestDesiredStateVersion: 12,
        latestJob: null,
        name: "interaction42-prod",
        openAiProvider: null,
        recentApplyRuns: [],
        recentEvents: [],
        recentJobs: [],
        serverStatus: "ready",
        status: "ready",
      },
      timeFormatPreference: "auto",
      timezone: "UTC",
    }),
    getPlatformOrganizations: async () => [
      {
        configuredRuntimeImage: "ghcr.io/froemic/openclaw:2026.4.8",
        configuredRuntimeImageVersion: "2026.4.8",
        id: "org_1",
        isReady: true,
        locale: "en-US",
        name: "Interaction42",
        observedRuntimeImage: "ghcr.io/froemic/openclaw:2026.4.8",
        observedRuntimeImageVersion: "2026.4.8",
        slackIntegration: null,
        slug: "interaction42",
        tenant: {
          id: "tenant_1",
          ipv4: "203.0.113.10",
          latestApplyRun: null,
          latestJob: null,
          name: "interaction42-prod",
          serverStatus: "ready",
          status: "ready",
        },
        timeFormatPreference: "auto",
        timezone: "UTC",
      },
    ],
    getPlatformUsage: async () => ({
      summary: {
        activeApiKeys: 1,
        activeModels: 1,
        totalCreditsBurnedMilli: 1000,
        totalInputTokens: 100,
        totalOutputTokens: 20,
        totalProviderCostMicros: 10_000,
        totalRequests: 5,
      },
      timeSeries: [],
      usageByModel: [],
      usageByType: [],
    }),
    getTenantRuntimeGatewayToken: async () => "gateway_token_123",
    grantPlatformOrganizationCredits: async () => ({
      balanceCreditsMilli: 100_000,
      grantedCreditsMilli: 50_000,
      ledgerEntryId: "ledger_1",
      tenantId: "tenant_1",
      tenantName: "interaction42-prod",
    }),
    hasPlatformAdminRole: async () => true,
    syncUserFromSession: async () => undefined,
    triggerPlatformOrganizationApply: async () => ({
      desiredStateChanged: false,
      desiredStateVersion: 12,
      jobId: "job_apply_1",
      queued: true,
      tenantId: "tenant_1",
      tenantName: "interaction42-prod",
    }),
    triggerPlatformOrganizationDeployRuntime: async () => ({
      desiredStateChanged: false,
      desiredStateVersion: 12,
      jobId: "job_deploy_1",
      queued: true,
      tenantId: "tenant_1",
      tenantName: "interaction42-prod",
    }),
    triggerPlatformOrganizationProvisionOpenAiKey: async () => ({
      action: "provision",
      jobId: "job_key_1",
      queued: true,
      tenantId: "tenant_1",
      tenantName: "interaction42-prod",
    }),
    triggerPlatformOrganizationRefreshImage: async () => ({
      jobId: "job_refresh_1",
      queued: true,
      tenantId: "tenant_1",
      tenantName: "interaction42-prod",
    }),
  }
}

function createPlatformTestApp(
  dependencies: PlatformRouteDependencies = createDependencies(),
) {
  const app = new Hono()

  return app.route("/", createPlatformRouter(dependencies))
}

describe("platform routes", () => {
  it("returns platform bootstrap data for platform admins", async () => {
    const app = createPlatformTestApp()
    const response = await app.request("http://api.local/api/platform/bootstrap")

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      organizations: [
        {
          name: "Interaction42",
          slug: "interaction42",
        },
      ],
      user: {
        email: "operator@getyourotto.com",
        id: "user_platform_1",
        isPlatformAdmin: true,
        name: "Platform Admin",
      },
    })
  })

  it("returns the platform organizations list", async () => {
    const app = createPlatformTestApp()
    const response = await app.request(
      "http://api.local/api/platform/organizations",
    )
    const data = (await response.json()) as {
      organizations: Array<{ slug: string }>
    }

    assert.equal(response.status, 200)
    assert.equal(data.organizations[0]?.slug, "interaction42")
  })

  it("returns a platform organization detail payload", async () => {
    const app = createPlatformTestApp()
    const response = await app.request(
      "http://api.local/api/platform/organizations/interaction42",
    )
    const data = (await response.json()) as {
      organization: { slug: string; tenant: { id: string } | null }
    }

    assert.equal(response.status, 200)
    assert.equal(data.organization.slug, "interaction42")
    assert.equal(data.organization.tenant?.id, "tenant_1")
  })

  it("returns platform usage data", async () => {
    const app = createPlatformTestApp()
    const response = await app.request(
      "http://api.local/api/platform/organizations/interaction42/usage?from=2026-01-01T00:00:00.000Z&to=2026-01-31T00:00:00.000Z",
    )
    const data = (await response.json()) as {
      summary: { totalRequests: number }
    }

    assert.equal(response.status, 200)
    assert.equal(data.summary.totalRequests, 5)
  })

  it("queues platform actions", async () => {
    const app = createPlatformTestApp()
    const response = await app.request(
      "http://api.local/api/platform/organizations/interaction42/apply",
      {
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      desiredStateChanged: false,
      desiredStateVersion: 12,
      jobId: "job_apply_1",
      queued: true,
      tenantId: "tenant_1",
      tenantName: "interaction42-prod",
    })
  })

  it("returns platform job status", async () => {
    const app = createPlatformTestApp()
    const response = await app.request(
      "http://api.local/api/platform/organizations/interaction42/jobs/job_apply_1/status",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      error: null,
      finishedAt: null,
      ok: true,
      status: "running",
    })
  })

  it("returns 403 for non-platform-admin users", async () => {
    const app = createPlatformTestApp({
      ...createDependencies(),
      hasPlatformAdminRole: async () => false,
    })
    const response = await app.request("http://api.local/api/platform/bootstrap")

    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), {
      code: "forbidden",
      message: "Platform admin access required",
    })
  })
})

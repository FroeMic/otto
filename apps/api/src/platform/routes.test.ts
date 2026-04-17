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
      billing: {
        currentBalanceCreditsMilli: 100_000,
        currentPeriodEnd: "2026-01-31T00:00:00.000Z",
        currentPeriodStart: "2026-01-01T00:00:00.000Z",
        totalDebitedCreditsMilli: 50_000,
        totalGrantedCreditsMilli: 150_000,
      },
      configuredRuntimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
      configuredRuntimeImageVersion: "2026.4.12",
      id: "org_1",
      isReady: true,
      locale: "en-US",
      name: "Interaction42",
      observedRuntimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
      observedRuntimeImageVersion: "2026.4.12",
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
        provisioningStrategy: "legacy_base_image",
        recentApplyRuns: [],
        recentEvents: [],
        recentJobs: [],
        serverStatus: "ready",
        status: "ready",
        sourceImage: "ubuntu-24.04",
      },
      timeFormatPreference: "auto",
      timezone: "UTC",
    }),
    createPlatformOrganization: async ({ name, slug }) => ({
      configuredRuntimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
      configuredRuntimeImageVersion: "2026.4.12",
      id: "org_new",
      isReady: false,
      locale: "en-US",
      name,
      observedRuntimeImage: null,
      observedRuntimeImageVersion: null,
      slackIntegration: null,
      slug: slug ?? "fresh-org",
      tenant: null,
      timeFormatPreference: "auto",
      timezone: "UTC",
    }),
    addCurrentUserAsPlatformOrganizationAdmin: async ({ orgSlug }) => ({
      membership: {
        id: "membership_1",
        organizationId: "org_1",
        organizationSlug: orgSlug,
        role: "admin",
        status: "active",
      },
    }),
    getPlatformOrganizations: async () => [
      {
        configuredRuntimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
        configuredRuntimeImageVersion: "2026.4.12",
        id: "org_1",
        isReady: true,
        locale: "en-US",
        name: "Interaction42",
        observedRuntimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
        observedRuntimeImageVersion: "2026.4.12",
        slackIntegration: null,
        slug: "interaction42",
        tenant: {
          id: "tenant_1",
          ipv4: "203.0.113.10",
          latestApplyRun: null,
          latestJob: null,
          name: "interaction42-prod",
          provisioningStrategy: "legacy_base_image",
          serverStatus: "ready",
          status: "ready",
          sourceImage: "ubuntu-24.04",
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
    triggerPlatformOrganizationSyncSkills: async () => ({
      desiredStateChanged: true,
      desiredStateVersion: 13,
      jobId: "job_sync_skills_1",
      queued: true,
      tenantId: "tenant_1",
      tenantName: "interaction42-prod",
    }),
    triggerPlatformOrganizationProvisionServer: async ({
      provisioningStrategy,
    }) => ({
      jobId: "job_provision_1",
      provisionedTenant: false,
      provisioningStrategy,
      queued: true,
      tenantId: "tenant_1",
      tenantName: "interaction42-prod",
    }),
    triggerPlatformOrganizationDeleteWorkspace: async () => ({
      jobId: "job_delete_1",
      organizationId: "org_1",
      organizationName: "Interaction42",
      organizationSlug: "interaction42",
      queued: true,
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

  it("creates a platform organization from scratch", async () => {
    const app = createPlatformTestApp()
    const response = await app.request(
      "http://api.local/api/platform/organizations",
      {
        body: JSON.stringify({
          name: "Fresh Org",
          slug: "fresh-org",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    )
    const data = (await response.json()) as {
      organization: { name: string; slug: string; tenant: null }
    }

    assert.equal(response.status, 200)
    assert.deepEqual(data.organization, {
      configuredRuntimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
      configuredRuntimeImageVersion: "2026.4.12",
      id: "org_new",
      isReady: false,
      locale: "en-US",
      name: "Fresh Org",
      observedRuntimeImage: null,
      observedRuntimeImageVersion: null,
      slackIntegration: null,
      slug: "fresh-org",
      tenant: null,
      timeFormatPreference: "auto",
      timezone: "UTC",
    })
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

  it("queues managed skill sync for a platform organization", async () => {
    const app = createPlatformTestApp()
    const response = await app.request(
      "http://api.local/api/platform/organizations/interaction42/sync-skills",
      {
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      desiredStateChanged: true,
      desiredStateVersion: 13,
      jobId: "job_sync_skills_1",
      queued: true,
      tenantId: "tenant_1",
      tenantName: "interaction42-prod",
    })
  })

  it("adds the platform user as an organization admin member", async () => {
    const app = createPlatformTestApp()
    const response = await app.request(
      "http://api.local/api/platform/organizations/interaction42/admin-membership",
      {
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      membership: {
        id: "membership_1",
        organizationId: "org_1",
        organizationSlug: "interaction42",
        role: "admin",
        status: "active",
      },
    })
  })

  it("queues platform server provisioning", async () => {
    const app = createPlatformTestApp()
    const response = await app.request(
      "http://api.local/api/platform/organizations/interaction42/provision-server",
      {
        body: JSON.stringify({
          provisioningStrategy: "legacy_base_image",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      jobId: "job_provision_1",
      provisionedTenant: false,
      provisioningStrategy: "legacy_base_image",
      queued: true,
      tenantId: "tenant_1",
      tenantName: "interaction42-prod",
    })
  })

  it("queues workspace deletion", async () => {
    const app = createPlatformTestApp()
    const response = await app.request(
      "http://api.local/api/platform/organizations/interaction42/delete-workspace",
      {
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      jobId: "job_delete_1",
      organizationId: "org_1",
      organizationName: "Interaction42",
      organizationSlug: "interaction42",
      queued: true,
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

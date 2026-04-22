import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  appendJobEvent: vi.fn(async () => undefined),
  enqueueJob: vi.fn(async () => "job_scheduled_tasks_sync_1"),
  getDb: vi.fn(),
  markJobFailed: vi.fn(async () => undefined),
  markJobSucceeded: vi.fn(async () => undefined),
  requeueJob: vi.fn(async () => undefined),
}))

vi.mock("../../db/client", () => ({
  getDb: mocks.getDb,
}))

vi.mock("./queue", async () => {
  const actual = await vi.importActual<typeof import("./queue")>("./queue")

  return {
    ...actual,
    appendJobEvent: mocks.appendJobEvent,
    enqueueJob: mocks.enqueueJob,
    markJobFailed: mocks.markJobFailed,
    markJobSucceeded: mocks.markJobSucceeded,
    requeueJob: mocks.requeueJob,
  }
})

function createReadyTenantDbMock() {
  const selectLimit = vi.fn(async () => [
    {
      organizationId: "org_1",
    },
  ])
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: selectLimit,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  }

  return {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  }
}

describe("provisioning scheduled task setup", () => {
  it("queues an initial scheduled task reconciliation when the tenant server becomes ready", async () => {
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto"
    process.env.SSH_AUTH_SOCK = "/tmp/agent.sock"
    const { __testing } = await import("../env")
    __testing.resetEnvCacheForTests()
    mocks.getDb.mockReturnValue(createReadyTenantDbMock())

    const { processProvisionTenantServerJob } = await import("./provisioning")
    const { JOB_TYPES, PROVISIONING_STEPS } = await import("./types")

    await processProvisionTenantServerJob({
      attempt: 1,
      id: "job_provision_1",
      jobType: JOB_TYPES.provisionTenantServer,
      payload: {
        ipv4: "203.0.113.10",
        providerServerId: "provider_server_1",
        step: PROVISIONING_STEPS.markServerReady,
        tenantId: "tenant_1",
      },
      tenantId: "tenant_1",
    })

    expect(mocks.enqueueJob).toHaveBeenCalledWith({
      jobType: JOB_TYPES.reconcileTenantScheduledTasks,
      payload: {
        tenantId: "tenant_1",
      },
    })
    expect(mocks.markJobSucceeded).toHaveBeenCalledWith(
      "job_provision_1",
      expect.objectContaining({
        scheduledTasksRefreshJobId: "job_scheduled_tasks_sync_1",
      }),
    )

    delete process.env.DATABASE_URL
    delete process.env.SSH_AUTH_SOCK
    __testing.resetEnvCacheForTests()
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}))

vi.mock("../../db/client", () => ({
  getDb: mocks.getDb,
}))

describe("getTenantRuntimeConnection", () => {
  beforeEach(() => {
    mocks.getDb.mockReset()
  })

  function createDbMock(tenantServerRow: {
    ipv4?: string | null
    serverStatus: string
    sshHost?: string | null
    sshPort?: number | null
    sshUsername?: string | null
    tenantStatus: string
  }) {
    return {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [tenantServerRow]),
            })),
          })),
        })),
      })),
    }
  }

  it("prefers sshHost and sshPort over ipv4 and runtime defaults", async () => {
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto"
    process.env.RUNTIME_SSH_PORT = "22"
    process.env.RUNTIME_DEPLOY_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----"

    const { __testing } = await import("../env")
    __testing.resetEnvCacheForTests()

    mocks.getDb.mockReturnValue(
      createDbMock({
        ipv4: "198.51.100.10",
        serverStatus: "ready",
        sshHost: "host.docker.internal",
        sshPort: 42001,
        sshUsername: "root",
        tenantStatus: "ready",
      }),
    )

    const { getTenantRuntimeConnection } = await import("./connection")
    const connection = await getTenantRuntimeConnection(
      "tenant_1",
      "test connection",
    )

    expect(connection).toEqual({
      host: "host.docker.internal",
      port: 42001,
      username: "root",
    })

    delete process.env.RUNTIME_DEPLOY_PRIVATE_KEY
    delete process.env.RUNTIME_SSH_PORT
    delete process.env.DATABASE_URL
    __testing.resetEnvCacheForTests()
  })

  it("falls back to ipv4 and env ssh port when ssh endpoint is missing", async () => {
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto"
    process.env.RUNTIME_SSH_PORT = "2200"
    process.env.RUNTIME_DEPLOY_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----"

    const { __testing } = await import("../env")
    __testing.resetEnvCacheForTests()

    mocks.getDb.mockReturnValue(
      createDbMock({
        ipv4: "198.51.100.11",
        serverStatus: "ready",
        sshHost: null,
        sshPort: null,
        sshUsername: null,
        tenantStatus: "ready",
      }),
    )

    const { getTenantRuntimeConnection } = await import("./connection")
    const connection = await getTenantRuntimeConnection(
      "tenant_2",
      "test connection",
    )

    expect(connection).toEqual({
      host: "198.51.100.11",
      port: 2200,
      username: "root",
    })

    delete process.env.RUNTIME_DEPLOY_PRIVATE_KEY
    delete process.env.RUNTIME_SSH_PORT
    delete process.env.DATABASE_URL
    __testing.resetEnvCacheForTests()
  })
})

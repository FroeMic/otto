import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getApiEnv: vi.fn(() => ({
    RUNTIME_DEPLOY_PRIVATE_KEY: undefined,
    RUNTIME_DEPLOY_PRIVATE_KEY_PATH: undefined,
    RUNTIME_SSH_COMMAND_TIMEOUT_MS: 30000,
    RUNTIME_SSH_CONNECT_TIMEOUT_MS: 5000,
    RUNTIME_SSH_PORT: 22,
    RUNTIME_SSH_USERNAME: "root",
  })),
  getDb: vi.fn(),
}))

vi.mock("@otto/feature-integrations-runtime/db/client", () => ({
  getDb: mocks.getDb,
}))

vi.mock("../env", () => ({
  getApiEnv: mocks.getApiEnv,
  normalizePrivateKeyValue: (value: string) => value,
}))

import { getTenantRuntimeConnection } from "./ssh"

function createDbMock(rows: Array<Record<string, unknown>>) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => rows),
          })),
        })),
      })),
    })),
  }
}

describe("tenant-runtime ssh connection lookup", () => {
  it("prefers tenant sshHost and sshPort over ipv4 defaults", async () => {
    mocks.getDb.mockReturnValue(
      createDbMock([
        {
          ipv4: "203.0.113.10",
          serverStatus: "ready",
          sshHost: "host.docker.internal",
          sshPort: 42005,
          sshUsername: "docker-user",
          tenantStatus: "ready",
        },
      ]),
    )

    await expect(
      getTenantRuntimeConnection("tenant_1", "runtime command"),
    ).resolves.toEqual({
      host: "host.docker.internal",
      port: 42005,
      username: "docker-user",
    })
  })

  it("falls back to ipv4 and runtime ssh port defaults", async () => {
    mocks.getDb.mockReturnValue(
      createDbMock([
        {
          ipv4: "198.51.100.20",
          serverStatus: "ready",
          sshHost: null,
          sshPort: null,
          sshUsername: null,
          tenantStatus: "ready",
        },
      ]),
    )

    await expect(
      getTenantRuntimeConnection("tenant_2", "runtime command"),
    ).resolves.toEqual({
      host: "198.51.100.20",
      port: 22,
      username: "root",
    })
  })
})

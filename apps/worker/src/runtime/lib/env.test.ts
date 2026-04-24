import { afterEach, describe, expect, it } from "vitest"

import { __testing, getEnv, getProvisioningProviderMode } from "./env"

const BASE_ENV = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/otto",
} as const

describe("getEnv legacy provisioning env shape", () => {
  function resetEnvForTest() {
    for (const key of [
      "DATABASE_URL",
      "HETZNER_API_TOKEN",
      "RUNTIME_DEPLOY_PRIVATE_KEY",
      "RUNTIME_DEPLOY_PRIVATE_KEY_PATH",
      "RUNTIME_OPENCLAW_IMAGE",
      "TENANT_RUNTIME_DOCKER_CONTAINER_PREFIX",
      "TENANT_RUNTIME_DOCKER_DOCKER_BIN",
      "TENANT_RUNTIME_DOCKER_HOST_IMAGE",
      "TENANT_RUNTIME_DOCKER_NETWORK",
      "TENANT_RUNTIME_DOCKER_POLL_INTERVAL_MS",
      "TENANT_RUNTIME_DOCKER_SSH_HOST",
      "TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_END",
      "TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_START",
      "TENANT_RUNTIME_DOCKER_SSH_USERNAME",
      "TENANT_RUNTIME_DOCKER_STARTUP_TIMEOUT_MS",
      "TENANT_RUNTIME_DOCKER_ENDPOINT_MODE",
      "TENANT_RUNTIME_PROVIDER",
    ]) {
      delete process.env[key]
    }
    __testing.resetEnvCacheForTests()
  }

  afterEach(() => {
    resetEnvForTest()
  })

  it("does not expose removed snapshot provisioning env settings", () => {
    resetEnvForTest()
    Object.assign(process.env, BASE_ENV)

    const env = getEnv()

    expect("HETZNER_ONBOARDING_PROVISIONING_MODE" in env).toBe(false)
    expect("HETZNER_DEFAULT_SNAPSHOT_IMAGE" in env).toBe(false)
    expect("HETZNER_SNAPSHOT_EXPECTED_RUNTIME_IMAGE" in env).toBe(false)
    expect("HETZNER_SNAPSHOT_GENERATION" in env).toBe(false)
  })

  it("uses explicit TENANT_RUNTIME_PROVIDER when set", () => {
    resetEnvForTest()
    Object.assign(process.env, BASE_ENV, {
      TENANT_RUNTIME_PROVIDER: "fake",
    })

    const env = getEnv()

    expect(env.TENANT_RUNTIME_PROVIDER).toBe("fake")
    expect(getProvisioningProviderMode()).toBe("fake")
  })

  it("falls back to hetzner when provider is auto and token exists", () => {
    resetEnvForTest()
    Object.assign(process.env, BASE_ENV, {
      HETZNER_API_TOKEN: "token",
      TENANT_RUNTIME_PROVIDER: "auto",
    })

    getEnv()
    expect(getProvisioningProviderMode()).toBe("hetzner")
  })

  it("falls back to fake when provider is auto and token is missing", () => {
    resetEnvForTest()
    Object.assign(process.env, BASE_ENV, {
      TENANT_RUNTIME_PROVIDER: "auto",
    })

    getEnv()
    expect(getProvisioningProviderMode()).toBe("fake")
  })

  it("falls back to fake when provider is unset and token is missing", () => {
    resetEnvForTest()
    Object.assign(process.env, BASE_ENV)

    getEnv()
    expect(getProvisioningProviderMode()).toBe("fake")
  })

  it("uses explicit hetzner mode even without a token", () => {
    resetEnvForTest()
    Object.assign(process.env, BASE_ENV, {
      TENANT_RUNTIME_PROVIDER: "hetzner",
    })

    getEnv()
    expect(getProvisioningProviderMode()).toBe("hetzner")
  })

  it("uses explicit docker mode when configured", () => {
    resetEnvForTest()
    Object.assign(process.env, BASE_ENV, {
      TENANT_RUNTIME_PROVIDER: "docker",
    })

    getEnv()
    expect(getProvisioningProviderMode()).toBe("docker")
  })

  it("uses docker defaults for provider configuration", () => {
    resetEnvForTest()
    Object.assign(process.env, BASE_ENV)

    const env = getEnv()

    expect(env.RUNTIME_OPENCLAW_IMAGE).toBe("ghcr.io/openclaw/openclaw:2026.4.22")
    expect(env.TENANT_RUNTIME_DOCKER_DOCKER_BIN).toBe("docker")
    expect(env.TENANT_RUNTIME_DOCKER_NETWORK).toBe("otto-tenant-lab")
    expect(env.TENANT_RUNTIME_DOCKER_SSH_HOST).toBe("127.0.0.1")
    expect(env.TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_START).toBe(42000)
    expect(env.TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_END).toBe(42999)
    expect(env.TENANT_RUNTIME_DOCKER_SSH_USERNAME).toBe("root")
    expect(env.TENANT_RUNTIME_DOCKER_ENDPOINT_MODE).toBe("published_port")
    expect(env.TENANT_RUNTIME_DOCKER_HOST_IMAGE).toBe(
      "ghcr.io/froemic/otto-tenant-host:latest",
    )
    expect(env.TENANT_RUNTIME_DOCKER_CONTAINER_PREFIX).toBe(
      "managed-tenant-host",
    )
  })

  it("throws when docker ssh range start is greater than end", () => {
    resetEnvForTest()
    Object.assign(process.env, BASE_ENV, {
      TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_END: "42000",
      TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_START: "42001",
    })

    expect(() => getEnv()).toThrow(
      "TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_START must be less than or equal to TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_END",
    )
  })
})

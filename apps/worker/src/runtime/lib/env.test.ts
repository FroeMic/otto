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
})

import { afterEach, describe, expect, it } from "vitest"

import { __testing, getEnv, getProvisioningProviderMode } from "./env"

const BASE_ENV = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/otto",
} as const

describe("getEnv legacy provisioning env shape", () => {
  afterEach(() => {
    for (const key of ["DATABASE_URL"]) {
      delete process.env[key]
    }
    __testing.resetEnvCacheForTests()
  })

  it("does not expose removed snapshot provisioning env settings", () => {
    Object.assign(process.env, BASE_ENV)
    __testing.resetEnvCacheForTests()

    const env = getEnv()

    expect("HETZNER_ONBOARDING_PROVISIONING_MODE" in env).toBe(false)
    expect("HETZNER_DEFAULT_SNAPSHOT_IMAGE" in env).toBe(false)
    expect("HETZNER_SNAPSHOT_EXPECTED_RUNTIME_IMAGE" in env).toBe(false)
    expect("HETZNER_SNAPSHOT_GENERATION" in env).toBe(false)
  })

  it("uses explicit TENANT_RUNTIME_PROVIDER when set", () => {
    Object.assign(process.env, BASE_ENV, {
      TENANT_RUNTIME_PROVIDER: "fake",
    })
    __testing.resetEnvCacheForTests()

    const env = getEnv()

    expect(env.TENANT_RUNTIME_PROVIDER).toBe("fake")
    expect(getProvisioningProviderMode()).toBe("fake")
  })

  it("falls back to hetzner when provider is auto and token exists", () => {
    Object.assign(process.env, BASE_ENV, {
      HETZNER_API_TOKEN: "token",
      TENANT_RUNTIME_PROVIDER: "auto",
    })
    __testing.resetEnvCacheForTests()

    getEnv()
    expect(getProvisioningProviderMode()).toBe("hetzner")
  })

  it("falls back to fake when provider is auto and token is missing", () => {
    Object.assign(process.env, BASE_ENV, {
      TENANT_RUNTIME_PROVIDER: "auto",
    })
    __testing.resetEnvCacheForTests()

    getEnv()
    expect(getProvisioningProviderMode()).toBe("fake")
  })

  it("falls back to fake when provider is unset and token is missing", () => {
    Object.assign(process.env, BASE_ENV)
    __testing.resetEnvCacheForTests()

    getEnv()
    expect(getProvisioningProviderMode()).toBe("fake")
  })

  it("uses explicit hetzner mode even without a token", () => {
    Object.assign(process.env, BASE_ENV, {
      TENANT_RUNTIME_PROVIDER: "hetzner",
    })
    __testing.resetEnvCacheForTests()

    getEnv()
    expect(getProvisioningProviderMode()).toBe("hetzner")
  })

  it("uses explicit docker mode when configured", () => {
    Object.assign(process.env, BASE_ENV, {
      TENANT_RUNTIME_PROVIDER: "docker",
    })
    __testing.resetEnvCacheForTests()

    getEnv()
    expect(getProvisioningProviderMode()).toBe("docker")
  })
})

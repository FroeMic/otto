import { afterEach, describe, expect, it } from "vitest"

import { __testing, getEnv } from "./env"

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
})

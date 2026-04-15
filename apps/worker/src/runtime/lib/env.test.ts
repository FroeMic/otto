import { afterEach, describe, expect, it } from "vitest";

import { __testing, getEnv } from "./env";

const BASE_ENV = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/otto",
} as const;

describe("getEnv snapshot provisioning defaults", () => {
  afterEach(() => {
    for (const key of [
      "DATABASE_URL",
      "HETZNER_ONBOARDING_PROVISIONING_MODE",
      "HETZNER_DEFAULT_SNAPSHOT_IMAGE",
      "HETZNER_SNAPSHOT_EXPECTED_RUNTIME_IMAGE",
      "HETZNER_SNAPSHOT_GENERATION",
    ]) {
      delete process.env[key];
    }
    __testing.resetEnvCacheForTests();
  });

  it("defaults onboarding provisioning to the legacy base-image path", () => {
    Object.assign(process.env, BASE_ENV);
    __testing.resetEnvCacheForTests();

    const env = getEnv();

    expect(env.HETZNER_ONBOARDING_PROVISIONING_MODE).toBe("legacy_base_image");
    expect(env.HETZNER_DEFAULT_SNAPSHOT_IMAGE).toBeUndefined();
    expect(env.HETZNER_SNAPSHOT_EXPECTED_RUNTIME_IMAGE).toBeUndefined();
    expect(env.HETZNER_SNAPSHOT_GENERATION).toBeUndefined();
  });

  it("parses the snapshot provisioning settings when explicitly enabled", () => {
    Object.assign(process.env, {
      ...BASE_ENV,
      HETZNER_DEFAULT_SNAPSHOT_IMAGE: "snapshot-123",
      HETZNER_ONBOARDING_PROVISIONING_MODE: "hetzner_snapshot",
      HETZNER_SNAPSHOT_EXPECTED_RUNTIME_IMAGE:
        "ghcr.io/openclaw/openclaw:2026.4.12",
      HETZNER_SNAPSHOT_GENERATION: "2026-04-15.1",
    });
    __testing.resetEnvCacheForTests();

    const env = getEnv();

    expect(env.HETZNER_ONBOARDING_PROVISIONING_MODE).toBe("hetzner_snapshot");
    expect(env.HETZNER_DEFAULT_SNAPSHOT_IMAGE).toBe("snapshot-123");
    expect(env.HETZNER_SNAPSHOT_EXPECTED_RUNTIME_IMAGE).toBe(
      "ghcr.io/openclaw/openclaw:2026.4.12",
    );
    expect(env.HETZNER_SNAPSHOT_GENERATION).toBe("2026-04-15.1");
  });
});

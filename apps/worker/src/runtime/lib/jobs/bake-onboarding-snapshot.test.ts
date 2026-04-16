import { afterEach, describe, expect, it, vi } from "vitest";

import { __testing as envTesting } from "../env";
import {
  processBakeHetznerOnboardingSnapshotJob,
  type BakeHetznerOnboardingSnapshotDeps,
} from "./bake-onboarding-snapshot";
import { JOB_TYPES } from "./types";

function buildDeps(
  overrides: Partial<BakeHetznerOnboardingSnapshotDeps> = {},
): BakeHetznerOnboardingSnapshotDeps {
  return {
    appendJobEvent: vi.fn(async () => undefined),
    createSnapshot: vi.fn(async () => ({
      actionId: "action_snapshot_1",
      id: "snapshot_1",
    })),
    createTemporaryServer: vi.fn(async () => ({
      actionId: "action_create_1",
      id: "server_1",
      provider: "hetzner",
    })),
    deleteServer: vi.fn(async () => undefined),
    fetchServer: vi.fn(async () => ({
      ipv4: "1.2.3.4",
      status: "off",
    })),
    markJobFailed: vi.fn(async () => undefined),
    markJobSucceeded: vi.fn(async () => undefined),
    powerOffServer: vi.fn(async () => "action_power_off_1"),
    prepareSnapshotHost: vi.fn(async () => undefined),
    requeueJob: vi.fn(async () => undefined),
    waitForServerAction: vi.fn(async () => undefined),
    waitForSsh: vi.fn(async () => undefined),
    waitForHostBootstrap: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("processBakeHetznerOnboardingSnapshotJob", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
    envTesting.resetEnvCacheForTests();
  });

  it("creates a temporary server and requeues the wait step", async () => {
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto";
    envTesting.resetEnvCacheForTests();
    const deps = buildDeps();

    await processBakeHetznerOnboardingSnapshotJob(
      {
        attempt: 1,
        id: "job_1",
        jobType: JOB_TYPES.bakeHetznerOnboardingSnapshot,
        payload: {
          baseImage: "ubuntu-24.04",
          generation: "2026-04-15.180000",
          runtimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
          step: "create_server",
        },
        tenantId: null,
      },
      deps,
    );

    expect(deps.createTemporaryServer).toHaveBeenCalledWith({
      baseImage: "ubuntu-24.04",
      generation: "2026-04-15.180000",
    });
    expect(deps.requeueJob).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        actionId: "action_create_1",
        providerServerId: "server_1",
        step: "wait_for_server_action",
      }),
      expect.any(Date),
    );
  });

  it("prepares the host, creates a snapshot, deletes the temp server, and completes", async () => {
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto";
    envTesting.resetEnvCacheForTests();
    const deps = buildDeps();

    await processBakeHetznerOnboardingSnapshotJob(
      {
        attempt: 1,
        id: "job_1",
        jobType: JOB_TYPES.bakeHetznerOnboardingSnapshot,
        payload: {
          baseImage: "ubuntu-24.04",
          generation: "2026-04-15.180000",
          ipv4: "1.2.3.4",
          providerServerId: "server_1",
          runtimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
          step: "prepare_snapshot_host",
        },
        tenantId: null,
      },
      deps,
    );

    expect(deps.prepareSnapshotHost).toHaveBeenCalledWith({
      baseImage: "ubuntu-24.04",
      generation: "2026-04-15.180000",
      ipv4: "1.2.3.4",
      runtimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
    });
    expect(deps.powerOffServer).toHaveBeenCalledWith("server_1");

    await processBakeHetznerOnboardingSnapshotJob(
      {
        attempt: 1,
        id: "job_1",
        jobType: JOB_TYPES.bakeHetznerOnboardingSnapshot,
        payload: {
          baseImage: "ubuntu-24.04",
          generation: "2026-04-15.180000",
          providerServerId: "server_1",
          runtimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
          step: "create_snapshot",
        },
        tenantId: null,
      },
      deps,
    );

    expect(deps.createSnapshot).toHaveBeenCalledWith({
      baseImage: "ubuntu-24.04",
      generation: "2026-04-15.180000",
      providerServerId: "server_1",
      runtimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
    });
    expect(deps.deleteServer).toHaveBeenCalledWith("server_1");
    expect(deps.markJobSucceeded).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        baseImage: "ubuntu-24.04",
        generation: "2026-04-15.180000",
        runtimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
        snapshotId: "snapshot_1",
      }),
    );
  });
});

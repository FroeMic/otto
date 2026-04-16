import { afterEach, describe, expect, it, vi } from "vitest";

import { __testing as envTesting } from "../env";
import {
  processProvisionTenantServerFromSnapshotJob,
  SNAPSHOT_PROVISIONING_STATUSES,
  type SnapshotProvisioningDeps,
} from "./provisioning-from-snapshot";
import { JOB_TYPES, SNAPSHOT_PROVISIONING_STEPS } from "./types";

function buildDeps(
  overrides: Partial<SnapshotProvisioningDeps> = {},
): SnapshotProvisioningDeps {
  return {
    appendJobEvent: vi.fn(async () => undefined),
    bootstrapTenantRuntime: vi.fn(async () => undefined),
    checkRuntime: vi.fn(async () => undefined),
    createProviderServerFromSnapshot: vi.fn(async () => ({
      actionId: "action_1",
      id: "server_1",
      provider: "hetzner",
      sourceImage: "snapshot-123",
      sourceSnapshotId: "snapshot-123",
    })),
    fetchServer: vi.fn(async () => ({
      ipv4: "1.2.3.4",
    })),
    markJobFailed: vi.fn(async () => undefined),
    markJobSucceeded: vi.fn(async () => undefined),
    markServerReady: vi.fn(async () => undefined),
    markTenantProvisioningFailed: vi.fn(async () => undefined),
    requeueJob: vi.fn(async () => undefined),
    startRuntime: vi.fn(async () => undefined),
    updateTenantServer: vi.fn(async () => undefined),
    verifySnapshotHostReady: vi.fn(async () => undefined),
    waitForServerAction: vi.fn(async () => "success" as const),
    waitForSsh: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("processProvisionTenantServerFromSnapshotJob", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.HETZNER_API_TOKEN;
    delete process.env.HETZNER_POLL_INTERVAL_MS;
    envTesting.resetEnvCacheForTests();
  });

  it("creates a snapshot-backed server and requeues the action wait step", async () => {
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto";
    envTesting.resetEnvCacheForTests();
    const deps = buildDeps();

    await processProvisionTenantServerFromSnapshotJob(
      {
        attempt: 1,
        id: "job_1",
        jobType: JOB_TYPES.provisionTenantServerFromSnapshot,
        payload: {
          step: SNAPSHOT_PROVISIONING_STEPS.createServerFromSnapshot,
          tenantId: "tenant_1",
        },
        tenantId: "tenant_1",
      },
      deps,
    );

    expect(deps.createProviderServerFromSnapshot).toHaveBeenCalledWith("tenant_1");
    expect(deps.updateTenantServer).toHaveBeenCalledWith("tenant_1", {
      provider: "hetzner",
      providerServerId: "server_1",
      provisioningStrategy: "hetzner_snapshot",
      snapshotGeneration: null,
      sourceImage: "snapshot-123",
      sourceSnapshotId: "snapshot-123",
      sshUsername: "root",
      status: SNAPSHOT_PROVISIONING_STATUSES.creatingServer,
    });
    expect(deps.requeueJob).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        actionId: "action_1",
        providerServerId: "server_1",
        sourceSnapshotId: "snapshot-123",
        step: SNAPSHOT_PROVISIONING_STEPS.waitForHetznerAction,
      }),
      expect.any(Date),
    );
  });

  it("verifies the baked snapshot host and requeues runtime bootstrap", async () => {
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto";
    envTesting.resetEnvCacheForTests();
    const deps = buildDeps();

    await processProvisionTenantServerFromSnapshotJob(
      {
        attempt: 1,
        id: "job_1",
        jobType: JOB_TYPES.provisionTenantServerFromSnapshot,
        payload: {
          ipv4: "1.2.3.4",
          providerServerId: "server_1",
          step: SNAPSHOT_PROVISIONING_STEPS.verifySnapshotHost,
          tenantId: "tenant_1",
        },
        tenantId: "tenant_1",
      },
      deps,
    );

    expect(deps.verifySnapshotHostReady).toHaveBeenCalledWith("1.2.3.4");
    expect(deps.updateTenantServer).toHaveBeenCalledWith("tenant_1", {
      status: SNAPSHOT_PROVISIONING_STATUSES.verifyingSnapshotHost,
    });
    expect(deps.requeueJob).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        step: SNAPSHOT_PROVISIONING_STEPS.bootstrapTenantRuntime,
      }),
      expect.any(Date),
    );
  });

  it("requeues snapshot host verification while the restored host is still settling", async () => {
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto";
    process.env.HETZNER_API_TOKEN = "test-token";
    process.env.HETZNER_POLL_INTERVAL_MS = "5000";
    envTesting.resetEnvCacheForTests();
    const deps = buildDeps({
      verifySnapshotHostReady: vi.fn(async () => {
        throw new Error("docker is not active");
      }),
    });

    await processProvisionTenantServerFromSnapshotJob(
      {
        attempt: 27,
        id: "job_1",
        jobType: JOB_TYPES.provisionTenantServerFromSnapshot,
        payload: {
          ipv4: "1.2.3.4",
          providerServerId: "server_1",
          snapshotHostVerifyStartedAt: new Date().toISOString(),
          sourceSnapshotId: "snapshot-123",
          step: SNAPSHOT_PROVISIONING_STEPS.verifySnapshotHost,
          tenantId: "tenant_1",
        },
        tenantId: "tenant_1",
      },
      deps,
    );

    expect(deps.markJobFailed).not.toHaveBeenCalled();
    expect(deps.appendJobEvent).toHaveBeenCalledWith(
      "job_1",
      SNAPSHOT_PROVISIONING_STATUSES.verifyingSnapshotHost,
      "Snapshot host contract is not ready yet",
      expect.objectContaining({
        error: "docker is not active",
        ipv4: "1.2.3.4",
        providerServerId: "server_1",
        sourceSnapshotId: "snapshot-123",
      }),
    );
    expect(deps.requeueJob).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        providerServerId: "server_1",
        snapshotHostVerifyStartedAt: expect.any(String),
        step: SNAPSHOT_PROVISIONING_STEPS.verifySnapshotHost,
      }),
      expect.any(Date),
    );
  });

  it("requeues the action wait step when Hetzner is still creating the server", async () => {
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto";
    process.env.HETZNER_API_TOKEN = "test-token";
    process.env.HETZNER_POLL_INTERVAL_MS = "5000";
    envTesting.resetEnvCacheForTests();
    const deps = buildDeps({
      waitForServerAction: vi.fn(async () => "running" as const),
    });

    await processProvisionTenantServerFromSnapshotJob(
      {
        attempt: 2,
        id: "job_1",
        jobType: JOB_TYPES.provisionTenantServerFromSnapshot,
        payload: {
          actionId: "action_1",
          providerServerId: "server_1",
          sourceSnapshotId: "snapshot-123",
          step: SNAPSHOT_PROVISIONING_STEPS.waitForHetznerAction,
          tenantId: "tenant_1",
        },
        tenantId: "tenant_1",
      },
      deps,
    );

    expect(deps.updateTenantServer).toHaveBeenCalledWith("tenant_1", {
      status: SNAPSHOT_PROVISIONING_STATUSES.waitingForServerAction,
    });
    expect(deps.appendJobEvent).toHaveBeenCalledWith(
      "job_1",
      SNAPSHOT_PROVISIONING_STATUSES.waitingForServerAction,
      "hetzner snapshot server action is still running",
      {
        actionId: "action_1",
        providerServerId: "server_1",
        sourceSnapshotId: "snapshot-123",
      },
    );
    expect(deps.requeueJob).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({
        actionId: "action_1",
        providerServerId: "server_1",
        step: SNAPSHOT_PROVISIONING_STEPS.waitForHetznerAction,
      }),
      expect.any(Date),
    );
    expect(deps.fetchServer).not.toHaveBeenCalled();
  });
});

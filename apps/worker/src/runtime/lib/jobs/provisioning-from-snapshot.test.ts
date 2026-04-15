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
    waitForServerAction: vi.fn(async () => undefined),
    waitForSsh: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("processProvisionTenantServerFromSnapshotJob", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
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
});

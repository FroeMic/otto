import { describe, expect, it, vi } from "vitest";

import { JOB_TYPES } from "./types";

const bakeSnapshotHandler = vi.fn(async () => undefined);
const snapshotHandler = vi.fn(async () => undefined);

vi.mock("./bake-onboarding-snapshot", () => ({
  processBakeHetznerOnboardingSnapshotJob: bakeSnapshotHandler,
}));

vi.mock("./provisioning-from-snapshot", () => ({
  processProvisionTenantServerFromSnapshotJob: snapshotHandler,
}));

describe("processClaimedJob snapshot dispatch", () => {
  it("routes onboarding snapshot bake jobs to the bake handler", async () => {
    const { processClaimedJob } = await import("./worker");

    await processClaimedJob({
      attempt: 1,
      id: "job_bake_1",
      jobType: JOB_TYPES.bakeHetznerOnboardingSnapshot,
      payload: {
        baseImage: "ubuntu-24.04",
        generation: "2026-04-15.180000",
        runtimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
        step: "create_server",
      },
      tenantId: null,
    });

    expect(bakeSnapshotHandler).toHaveBeenCalledWith({
      attempt: 1,
      id: "job_bake_1",
      jobType: JOB_TYPES.bakeHetznerOnboardingSnapshot,
      payload: {
        baseImage: "ubuntu-24.04",
        generation: "2026-04-15.180000",
        runtimeImage: "ghcr.io/froemic/openclaw:2026.4.12",
        step: "create_server",
      },
      tenantId: null,
    });
  });

  it("routes snapshot-backed provisioning jobs to the snapshot handler", async () => {
    const { processClaimedJob } = await import("./worker");

    await processClaimedJob({
      attempt: 1,
      id: "job_1",
      jobType: JOB_TYPES.provisionTenantServerFromSnapshot,
      payload: {
        step: "create_server_from_snapshot",
        tenantId: "tenant_1",
      },
      tenantId: "tenant_1",
    });

    expect(snapshotHandler).toHaveBeenCalledWith({
      attempt: 1,
      id: "job_1",
      jobType: JOB_TYPES.provisionTenantServerFromSnapshot,
      payload: {
        step: "create_server_from_snapshot",
        tenantId: "tenant_1",
      },
      tenantId: "tenant_1",
    });
  });
});

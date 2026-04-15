import { describe, expect, it, vi } from "vitest";

import { JOB_TYPES } from "./types";

const snapshotHandler = vi.fn(async () => undefined);

vi.mock("./provisioning-from-snapshot", () => ({
  processProvisionTenantServerFromSnapshotJob: snapshotHandler,
}));

describe("processClaimedJob snapshot dispatch", () => {
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

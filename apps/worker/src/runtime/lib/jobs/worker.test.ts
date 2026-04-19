import { describe, expect, it, vi } from "vitest";

import { JOB_TYPES } from "./types";

const provisioningHandler = vi.fn(async () => undefined);
const deleteTenantServerHandler = vi.fn(async () => undefined);
const pruneJobHistoryHandler = vi.fn(async () => undefined);

vi.mock("./provisioning", () => ({
  processProvisionTenantServerJob: provisioningHandler,
}));

vi.mock("./delete-tenant-server", () => ({
  processDeleteTenantServerJob: deleteTenantServerHandler,
}));

vi.mock("./retention", () => ({
  processPruneJobHistoryJob: pruneJobHistoryHandler,
}));

describe("processClaimedJob legacy dispatch", () => {
  it("routes legacy provisioning jobs to the provisioning handler", async () => {
    const { processClaimedJob } = await import("./worker");

    await processClaimedJob({
      attempt: 1,
      id: "job_provision_1",
      jobType: JOB_TYPES.provisionTenantServer,
      payload: {
        step: "create_server",
        tenantId: "tenant_1",
      },
      tenantId: "tenant_1",
    });

    expect(provisioningHandler).toHaveBeenCalledWith({
      attempt: 1,
      id: "job_provision_1",
      jobType: JOB_TYPES.provisionTenantServer,
      payload: {
        step: "create_server",
        tenantId: "tenant_1",
      },
      tenantId: "tenant_1",
    });
  });

  it("routes tenant-server deletion jobs to the delete tenant server handler", async () => {
    const { processClaimedJob } = await import("./worker");

    await processClaimedJob({
      attempt: 1,
      id: "job_delete_server_1",
      jobType: JOB_TYPES.deleteTenantServer,
      payload: {
        tenantId: "tenant_1",
      },
      tenantId: "tenant_1",
    });

    expect(deleteTenantServerHandler).toHaveBeenCalledWith({
      attempt: 1,
      id: "job_delete_server_1",
      jobType: JOB_TYPES.deleteTenantServer,
      payload: {
        tenantId: "tenant_1",
      },
      tenantId: "tenant_1",
    });
  });

  it("routes job history cleanup jobs to the retention handler", async () => {
    const { processClaimedJob } = await import("./worker");

    await processClaimedJob({
      attempt: 1,
      id: "job_prune_history_1",
      jobType: JOB_TYPES.pruneJobHistory,
      payload: {},
      tenantId: null,
    });

    expect(pruneJobHistoryHandler).toHaveBeenCalledWith({
      attempt: 1,
      id: "job_prune_history_1",
      jobType: JOB_TYPES.pruneJobHistory,
      payload: {},
      tenantId: null,
    });
  });
});

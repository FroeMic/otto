import { describe, expect, it, vi } from "vitest";

import { JOB_TYPES } from "./types";

const provisioningHandler = vi.fn(async () => undefined);

vi.mock("./provisioning", () => ({
  processProvisionTenantServerJob: provisioningHandler,
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
});

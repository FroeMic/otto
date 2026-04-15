import { describe, expect, it } from "vitest";

import {
  getJobLane,
  getJobTypesForLane,
  getTenantMutexGuardJobTypesForLane,
  JOB_LANES,
} from "./lanes";
import { JOB_TYPES } from "./types";

describe("job lane metadata", () => {
  it("routes workspace chat turns through a dedicated interactive lane", () => {
    expect(getJobLane(JOB_TYPES.runWorkspaceChatTurn)).toBe(JOB_LANES.chat);
    expect(getJobTypesForLane(JOB_LANES.chat)).toContain(
      JOB_TYPES.runWorkspaceChatTurn,
    );
  });

  it("does not let workspace chat turns inherit the broad tenant sync mutex", () => {
    expect(getTenantMutexGuardJobTypesForLane(JOB_LANES.chat)).not.toContain(
      JOB_TYPES.runWorkspaceChatTurn,
    );
    expect(
      getTenantMutexGuardJobTypesForLane(JOB_LANES.chat),
    ).not.toContain(JOB_TYPES.syncTenantSessions);
    expect(
      getTenantMutexGuardJobTypesForLane(JOB_LANES.chat),
    ).not.toContain(JOB_TYPES.reconcileTenantScheduledTasks);
  });

  it("still blocks interactive and integration work behind runtime-exclusive operations", () => {
    const runtimeMutationJobTypes = [
      JOB_TYPES.provisionTenantServer,
      JOB_TYPES.provisionTenantServerFromSnapshot,
      JOB_TYPES.provisionTenantOpenAiKey,
      JOB_TYPES.applyTenantConfig,
      JOB_TYPES.refreshRuntimeImage,
      JOB_TYPES.whatsappLinkSession,
      JOB_TYPES.whatsappDisconnect,
    ];

    expect(getTenantMutexGuardJobTypesForLane(JOB_LANES.chat)).toEqual(
      runtimeMutationJobTypes,
    );
    expect(getTenantMutexGuardJobTypesForLane(JOB_LANES.integrations)).toEqual(
      runtimeMutationJobTypes,
    );
  });

  it("routes snapshot-backed tenant provisioning through the runtime lane", () => {
    expect(getJobLane(JOB_TYPES.provisionTenantServerFromSnapshot)).toBe(
      JOB_LANES.runtime,
    );
    expect(getJobTypesForLane(JOB_LANES.runtime)).toContain(
      JOB_TYPES.provisionTenantServerFromSnapshot,
    );
  });
});

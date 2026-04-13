import { describe, expect, it } from "vitest";

import {
  getJobTypesForLane,
  getTenantMutexGuardJobTypesForLane,
  JOB_LANES,
} from "./lanes";
import { JOB_TYPES } from "./types";

describe("job lane metadata", () => {
  it("does not let workspace chat turns inherit the broad tenant sync mutex", () => {
    expect(getJobTypesForLane(JOB_LANES.runtime)).toContain(
      JOB_TYPES.runWorkspaceChatTurn,
    );

    expect(getTenantMutexGuardJobTypesForLane(JOB_LANES.runtime)).not.toContain(
      JOB_TYPES.runWorkspaceChatTurn,
    );
    expect(
      getTenantMutexGuardJobTypesForLane(JOB_LANES.runtime),
    ).not.toContain(JOB_TYPES.syncTenantSessions);
    expect(
      getTenantMutexGuardJobTypesForLane(JOB_LANES.runtime),
    ).not.toContain(JOB_TYPES.reconcileTenantScheduledTasks);
  });

  it("still blocks tenant sync work behind runtime-exclusive operations", () => {
    expect(
      getTenantMutexGuardJobTypesForLane(JOB_LANES.integrations),
    ).toEqual([
      JOB_TYPES.provisionTenantServer,
      JOB_TYPES.provisionTenantOpenAiKey,
      JOB_TYPES.applyTenantConfig,
      JOB_TYPES.refreshRuntimeImage,
      JOB_TYPES.whatsappLinkSession,
      JOB_TYPES.whatsappDisconnect,
    ]);
  });
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  getJobLane,
  getJobTypesForLane,
  getRecurringSchedulerJobTypes,
  getTenantMutexJobTypes,
  JOB_LANES,
  laneUsesTenantMutex,
} from "./lanes";
import { JOB_TYPES } from "./types";

test("maps job types into the expected resource lanes", () => {
  assert.equal(getJobLane(JOB_TYPES.applyTenantConfig), JOB_LANES.runtime);
  assert.equal(
    getJobLane(JOB_TYPES.refreshOauthConnection),
    JOB_LANES.integrations,
  );
  assert.equal(
    getJobLane(JOB_TYPES.reconcileTenantScheduledTasks),
    JOB_LANES.integrations,
  );
  assert.equal(getJobLane(JOB_TYPES.syncOpenAiUsageTarget), JOB_LANES.metering);
  assert.equal(
    getJobLane(JOB_TYPES.settleCreditUsageChunk),
    JOB_LANES.settlement,
  );
});

test("marks only runtime and integrations lanes as tenant-mutex lanes", () => {
  assert.equal(laneUsesTenantMutex(JOB_LANES.runtime), true);
  assert.equal(laneUsesTenantMutex(JOB_LANES.integrations), true);
  assert.equal(laneUsesTenantMutex(JOB_LANES.metering), false);
  assert.equal(laneUsesTenantMutex(JOB_LANES.settlement), false);

  const tenantMutexJobTypes = new Set(getTenantMutexJobTypes());
  assert.equal(tenantMutexJobTypes.has(JOB_TYPES.applyTenantConfig), true);
  assert.equal(tenantMutexJobTypes.has(JOB_TYPES.syncOpenAiUsageTarget), false);
});

test("exposes recurring scheduler jobs and lane job type lists", () => {
  assert.deepEqual(
    new Set(getRecurringSchedulerJobTypes()),
    new Set([
      JOB_TYPES.scheduleOauthConnectionRefresh,
      JOB_TYPES.scheduleOpenAiUsageSync,
      JOB_TYPES.scheduleCreditSettlement,
      JOB_TYPES.scheduleBillingAutoTopOffEnqueue,
    ]),
  );

  assert.deepEqual(
    new Set(getJobTypesForLane(JOB_LANES.metering)),
    new Set([
      JOB_TYPES.scheduleOpenAiUsageSync,
      JOB_TYPES.syncOpenAiUsageTarget,
    ]),
  );
});

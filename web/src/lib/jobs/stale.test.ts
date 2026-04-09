import assert from "node:assert/strict";
import test from "node:test";

import { getJobStaleTimeoutMs } from "./stale";
import { JOB_TYPES } from "./types";

test("apply tenant config uses a shorter stale timeout for config-only apply", () => {
  assert.equal(
    getJobStaleTimeoutMs(
      {
        jobType: JOB_TYPES.applyTenantConfig,
        payload: {
          desiredStateVersion: 12,
          tenantId: "tenant-1",
        },
      },
      1_800_000,
    ),
    60_000,
  );
});

test("apply tenant config allows longer stale timeout when pulling an image first", () => {
  assert.equal(
    getJobStaleTimeoutMs(
      {
        jobType: JOB_TYPES.applyTenantConfig,
        payload: {
          desiredStateVersion: 12,
          pullImageFirst: true,
          tenantId: "tenant-1",
        },
      },
      1_800_000,
    ),
    180_000,
  );
});

test("other jobs keep the default stale timeout", () => {
  assert.equal(
    getJobStaleTimeoutMs(
      {
        jobType: JOB_TYPES.syncTenantSessions,
        payload: {
          tenantId: "tenant-1",
        },
      },
      1_800_000,
    ),
    1_800_000,
  );
});

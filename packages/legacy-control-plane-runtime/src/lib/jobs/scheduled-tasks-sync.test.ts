import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readCronListEntries,
  readCronRunEntries,
} from "./scheduled-tasks-sync";

describe("readCronListEntries", () => {
  it("reads jobs from the OpenClaw cron.list page shape", () => {
    const jobs = readCronListEntries({
      hasMore: false,
      jobs: [{ id: "job-1", name: "Hourly sync" }],
      limit: 50,
      nextOffset: null,
      offset: 0,
      total: 1,
    });

    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.id, "job-1");
    assert.equal(jobs[0]?.name, "Hourly sync");
  });

  it("throws instead of silently treating malformed payloads as empty", () => {
    assert.throws(
      () =>
        readCronListEntries({
          total: 1,
        }),
      /jobs array/,
    );
  });
});

describe("readCronRunEntries", () => {
  it("reads entries from the OpenClaw cron.runs page shape", () => {
    const entries = readCronRunEntries({
      entries: [{ jobId: "job-1", status: "ok", ts: 123 }],
      hasMore: false,
      limit: 50,
      nextOffset: null,
      offset: 0,
      total: 1,
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.jobId, "job-1");
    assert.equal(entries[0]?.status, "ok");
  });
});

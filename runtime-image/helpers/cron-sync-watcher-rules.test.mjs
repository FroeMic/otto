import assert from "node:assert/strict";
import test from "node:test";

import {
  isCronRunLogFileName,
  isCronTaskRefreshFileName,
} from "./cron-sync-watcher-rules.mjs";

test("cron task refresh files include config and runtime state", () => {
  assert.equal(isCronTaskRefreshFileName("jobs.json"), true);
  assert.equal(isCronTaskRefreshFileName("jobs-state.json"), true);
  assert.equal(isCronTaskRefreshFileName("runs"), false);
  assert.equal(isCronTaskRefreshFileName("other.json"), false);
  assert.equal(isCronTaskRefreshFileName(""), false);
});

test("cron run log files remain jsonl files only", () => {
  assert.equal(isCronRunLogFileName("job-1.jsonl"), true);
  assert.equal(isCronRunLogFileName("job-1.json"), false);
  assert.equal(isCronRunLogFileName("jobs-state.json"), false);
  assert.equal(isCronRunLogFileName(""), false);
});

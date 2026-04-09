import assert from "node:assert/strict";
import test from "node:test";

import { getStaleDirectoryIds } from "./messaging-directory";

test("getStaleDirectoryIds returns IDs that are missing from the latest sync", () => {
  assert.deepEqual(
    getStaleDirectoryIds({
      currentIds: ["U1", "U2", "U3"],
      syncedIds: ["U2", "U3", "U4"],
    }),
    ["U1"],
  );
});

test("getStaleDirectoryIds trims blanks and de-duplicates stale IDs", () => {
  assert.deepEqual(
    getStaleDirectoryIds({
      currentIds: [" U1 ", "U1", "", "U2"],
      syncedIds: [" U2 ", "  "],
    }),
    ["U1"],
  );
});

test("getStaleDirectoryIds returns all current IDs when the latest sync is empty", () => {
  assert.deepEqual(
    getStaleDirectoryIds({
      currentIds: ["U1", "U2"],
      syncedIds: [],
    }),
    ["U1", "U2"],
  );
});

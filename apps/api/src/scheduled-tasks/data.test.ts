import { describe, expect, it } from "vitest"

import { getLatestScheduledTasksSyncedAt } from "./data"

describe("getLatestScheduledTasksSyncedAt", () => {
  it("uses the latest successful refresh finish time when a runtime sync returns no tasks", () => {
    expect(
      getLatestScheduledTasksSyncedAt([], {
        createdAt: new Date("2026-04-18T17:59:00.000Z"),
        error: null,
        finishedAt: new Date("2026-04-18T18:00:00.000Z"),
        id: "job_refresh_1",
        startedAt: new Date("2026-04-18T17:59:30.000Z"),
        status: "succeeded",
      })?.toISOString(),
    ).toBe("2026-04-18T18:00:00.000Z")
  })
})

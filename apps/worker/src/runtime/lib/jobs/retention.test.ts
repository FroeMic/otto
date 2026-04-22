import { describe, expect, it } from "vitest"

import {
  getJobRetentionCutoff,
  getJobRetentionPolicy,
  JOB_GC_INTERVAL_MS,
} from "./retention"
import { JOB_TYPES } from "./types"

describe("job retention policy", () => {
  it("defines per-job lifetimes and failed deletion policy", () => {
    expect(getJobRetentionPolicy(JOB_TYPES.runWorkspaceChatTurn)).toEqual({
      deleteFailed: true,
      retentionMs: 24 * 60 * 60 * 1000,
    })

    expect(getJobRetentionPolicy(JOB_TYPES.applyTenantConfig)).toEqual({
      deleteFailed: false,
      retentionMs: 7 * 24 * 60 * 60 * 1000,
    })

    expect(getJobRetentionPolicy(JOB_TYPES.scheduleOpenAiUsageSync)).toEqual({
      deleteFailed: true,
      retentionMs: 60 * 60 * 1000,
    })
  })

  it("uses a one hour garbage-collection interval", () => {
    expect(JOB_GC_INTERVAL_MS).toBe(60 * 60 * 1000)
  })

  it("computes retention cutoffs from the supplied clock", () => {
    const now = new Date("2026-04-19T12:00:00.000Z")

    expect(
      getJobRetentionCutoff(JOB_TYPES.runWorkspaceChatTurn, now).toISOString(),
    ).toBe("2026-04-18T12:00:00.000Z")
  })
})

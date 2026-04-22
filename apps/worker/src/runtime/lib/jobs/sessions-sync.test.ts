import { describe, expect, it } from "vitest"

import { __testing } from "./sessions-sync"

describe("session sync reconciliation helpers", () => {
  it("prefers run-specific cron keys over base cron keys for the same session", () => {
    const keys = __testing.selectCanonicalSessionKeys({
      "agent:main:cron:daily-review": {
        sessionId: "session_1",
      },
      "agent:main:cron:daily-review:run:session_1": {
        sessionId: "session_1",
      },
      "agent:main:workspace:chat": {
        sessionId: "session_2",
      },
    })

    expect(keys).toEqual([
      "agent:main:cron:daily-review:run:session_1",
      "agent:main:workspace:chat",
    ])
  })

  it("prefers run-specific cron keys over base cron keys for the same job even when runtime session ids differ", () => {
    const baseCronKey = "agent:main:cron:job-1"
    const runCronKey = `${baseCronKey}:run:run-1`
    const workspaceChatKey =
      "agent:main:otto-workspace-chat:channel:workspace:conversation-1"
    const keys = __testing.selectCanonicalSessionKeys({
      [baseCronKey]: {
        sessionId: "base_session",
      },
      [runCronKey]: {
        sessionId: "run_session",
      },
      [workspaceChatKey]: {
        sessionId: "workspace_session",
      },
    })

    expect(keys).toEqual([runCronKey, workspaceChatKey])
  })

  it("reconciles missing, newer, and transcript-missing sessions only", () => {
    expect(
      __testing.shouldReconcileSession({
        existing: null,
        runtimeSessionUpdatedAt: 100,
      }),
    ).toEqual({ readTranscript: true, reconcile: true, reason: "missing" })

    expect(
      __testing.shouldReconcileSession({
        existing: {
          sessionUpdatedAt: 100,
          transcriptHash: "hash_1",
        },
        runtimeSessionUpdatedAt: 200,
      }),
    ).toEqual({ readTranscript: true, reconcile: true, reason: "newer" })

    expect(
      __testing.shouldReconcileSession({
        existing: {
          sessionUpdatedAt: 100,
          transcriptHash: null,
        },
        runtimeSessionUpdatedAt: 100,
      }),
    ).toEqual({
      readTranscript: true,
      reconcile: true,
      reason: "missing_transcript_hash",
    })

    expect(
      __testing.shouldReconcileSession({
        existing: {
          sessionUpdatedAt: 200,
          transcriptHash: "hash_1",
        },
        runtimeSessionUpdatedAt: 100,
      }),
    ).toEqual({ readTranscript: false, reconcile: false, reason: "unchanged" })
  })
})

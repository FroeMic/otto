import assert from "node:assert/strict"
import { describe, it } from "vitest"

import {
  buildAndEvaluateIntegrationTestingReadiness,
  buildIntegrationTestingChecklist,
} from "./testing-harness"

describe("integration testing harness", () => {
  it("builds workspace-managed oauth checklist requirements for slack", () => {
    const checklist = buildIntegrationTestingChecklist({
      integrationKey: "slack",
    })
    const ids = new Set(checklist.items.map((item) => item.id))

    assert.equal(ids.has("third-party-mock-contracts"), true)
    assert.equal(ids.has("internal-framework-coverage"), true)
    assert.equal(ids.has("agent-flow-discover-inspect-execute"), true)
    assert.equal(ids.has("ui-connect-disconnect-flow"), true)
    assert.equal(ids.has("agent-settings-validate-apply"), true)
    assert.equal(ids.has("oauth-connect-reconnect-needs-attention"), true)
    assert.equal(ids.has("ingress-routing-and-diagnostics"), false)
    assert.equal(ids.has("api-key-scope-validation"), false)
    assert.equal(ids.has("third-party-live-smoke"), true)
  })

  it("builds platform-managed read-only settings checklist for brave", () => {
    const checklist = buildIntegrationTestingChecklist({
      integrationKey: "brave",
    })
    const ids = new Set(checklist.items.map((item) => item.id))

    assert.equal(ids.has("ui-connect-disconnect-flow"), false)
    assert.equal(ids.has("agent-settings-readonly-get"), true)
    assert.equal(ids.has("agent-settings-validate-apply"), false)
    assert.equal(ids.has("oauth-connect-reconnect-needs-attention"), false)
    assert.equal(ids.has("api-key-scope-validation"), false)
  })

  it("builds api-key checklist requirements for posthog", () => {
    const checklist = buildIntegrationTestingChecklist({
      integrationKey: "posthog",
    })
    const ids = new Set(checklist.items.map((item) => item.id))

    assert.equal(ids.has("api-key-scope-validation"), true)
    assert.equal(ids.has("oauth-connect-reconnect-needs-attention"), false)
    assert.equal(ids.has("agent-settings-validate-apply"), false)
  })

  it("marks readiness failed when required checks are missing", () => {
    const result = buildAndEvaluateIntegrationTestingReadiness({
      coverageRecords: [
        {
          key: "third-party-mock-contracts",
          status: "pass",
          testType: "third_party_mock",
        },
        {
          key: "internal-framework-coverage",
          status: "pass",
          testType: "internal",
        },
      ],
      integrationKey: "gandi",
    })

    assert.equal(result.passed, false)
    assert.equal(result.score.requiredTotal > result.score.requiredPassCount, true)
    assert.equal(
      result.score.failedRequiredChecks.includes(
        "agent-flow-discover-inspect-execute",
      ),
      true,
    )
  })

  it("marks readiness passed when all required checks pass", () => {
    const checklist = buildIntegrationTestingChecklist({
      integrationKey: "gandi",
    })
    const coverageRecords = checklist.items.map((item) => ({
      key: item.id,
      status: "pass" as const,
      testType: item.testType,
    }))

    const result = buildAndEvaluateIntegrationTestingReadiness({
      coverageRecords,
      integrationKey: "gandi",
    })

    assert.equal(result.passed, true)
    assert.equal(
      result.score.requiredPassCount,
      result.score.requiredTotal,
    )
    assert.equal(result.failures.length, 0)
  })
})

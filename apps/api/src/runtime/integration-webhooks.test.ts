import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { buildSlackForwardDiagnostics } from "./integration-webhooks"

describe("integration webhook diagnostics", () => {
  it("logs the target URL and bounded request/response details by default", () => {
    const diagnostics = buildSlackForwardDiagnostics({
      requestBody: "token=secret&team_id=T123&text=hello",
      response: {
        body: "Not Found",
        headers: {
          "content-type": "text/plain",
        },
        status: 404,
      },
      targetUrl: "http://127.0.0.1:18791/slack/events",
    })

    assert.deepEqual(diagnostics, {
      requestBodyBytes: 36,
      requestBodyPreview: "token=secret&team_id=T123&text=hello",
      responseBodyBytes: 9,
      responseBodyPreview: "Not Found",
      responseHeaders: {
        "content-type": "text/plain",
      },
      responseStatus: 404,
      targetUrl: "http://127.0.0.1:18791/slack/events",
    })
    assert.equal("requestBody" in diagnostics, false)
    assert.equal("responseBody" in diagnostics, false)
  })

  it("includes exact request and response bodies only when requested", () => {
    const diagnostics = buildSlackForwardDiagnostics({
      includeExactBodies: true,
      requestBody: "team_id=T123&text=hello",
      response: {
        body: "Not Found",
        headers: {},
        status: 404,
      },
      targetUrl: "http://127.0.0.1:18791/slack/events",
    })

    assert.equal(diagnostics.requestBody, "team_id=T123&text=hello")
    assert.equal(diagnostics.responseBody, "Not Found")
  })
})

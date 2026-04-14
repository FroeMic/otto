import assert from "node:assert/strict"
import {
  GandiApiError,
  LinearGraphqlError,
} from "@otto/feature-integrations-runtime"
import { describe, it } from "vitest"

import { buildExecutionErrorResponse } from "./error-response"

describe("gateway execution error responses", () => {
  it("adds a membership hint for forbidden team commands", () => {
    const response = buildExecutionErrorResponse({
      commandKey: "team.update",
      error: new LinearGraphqlError(
        "You don't have permission to update this team's settings.",
        {
          code: "FORBIDDEN",
          userPresentableMessage:
            "You don't have permission to update this team's settings.",
        },
      ),
    }) as {
      error: string
      hint?: string
    }

    assert.equal(
      response.error,
      "You don't have permission to update this team's settings.",
    )
    assert.equal(
      response.hint,
      "Otto may need to be added to that Linear team before retrying this team command.",
    )
  })

  it("does not add the membership hint for team create plan-limit errors", () => {
    const response = buildExecutionErrorResponse({
      commandKey: "team.create",
      error: new LinearGraphqlError(
        "You have reached the limit of teams allowed in your current plan. Please upgrade to create more teams.",
        {
          code: "FORBIDDEN",
          userPresentableMessage:
            "You have reached the limit of teams allowed in your current plan. Please upgrade to create more teams.",
        },
      ),
    }) as {
      error: string
      hint?: string
    }

    assert.equal(
      response.error,
      "You have reached the limit of teams allowed in your current plan. Please upgrade to create more teams.",
    )
    assert.equal(response.hint, undefined)
  })

  it("uses a stronger permission hint for team delete", () => {
    const response = buildExecutionErrorResponse({
      commandKey: "team.delete",
      error: new LinearGraphqlError(
        "Only a workspace administrator or team owner can delete this team.",
        {
          code: "FORBIDDEN",
          userPresentableMessage:
            "Only a workspace administrator or team owner can delete this team.",
        },
      ),
    }) as {
      error: string
      hint?: string
    }

    assert.equal(
      response.error,
      "Only a workspace administrator or team owner can delete this team.",
    )
    assert.equal(
      response.hint,
      "Otto's current Linear actor may need workspace-admin or team-owner permissions before retrying this team command.",
    )
  })

  it("adds a retry hint for Gandi rate-limit failures", () => {
    const response = buildExecutionErrorResponse({
      commandKey: "domain.batch_check",
      error: new GandiApiError({
        cause: "rate_limited",
        message: "Rate limit exceeded",
        rateLimited: true,
        status: 429,
        transient: true,
      }),
    }) as {
      error: string
      hint?: string
    }

    assert.equal(
      response.error,
      "Gandi API request failed with status 429: Rate limit exceeded",
    )
    assert.equal(
      response.hint,
      "Gandi rate-limited this request. Retry shortly and prefer batch domain checks over repeated one-off calls.",
    )
  })

  it("adds a transient retry hint for temporary Gandi failures", () => {
    const response = buildExecutionErrorResponse({
      commandKey: "domain.check_availability",
      error: new GandiApiError({
        cause: "upstream_timeout",
        message: "temporary timeout",
        status: 504,
        transient: true,
      }),
    }) as {
      error: string
      hint?: string
    }

    assert.equal(
      response.error,
      "Gandi API request failed with status 504: temporary timeout",
    )
    assert.equal(
      response.hint,
      "Gandi returned a temporary provider error. Retry this command.",
    )
  })
})

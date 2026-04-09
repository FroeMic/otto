import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildExecutionErrorResponse } from "./handler";
import { LinearGraphqlError } from "../integrations/library/linear/client";

describe("integration gateway execution error responses", () => {
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
      error: string;
      hint?: string;
    };

    assert.equal(
      response.error,
      "You don't have permission to update this team's settings.",
    );
    assert.equal(
      response.hint,
      "Otto may need to be added to that Linear team before retrying this team command.",
    );
  });

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
      error: string;
      hint?: string;
    };

    assert.equal(
      response.error,
      "You have reached the limit of teams allowed in your current plan. Please upgrade to create more teams.",
    );
    assert.equal(response.hint, undefined);
  });

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
      error: string;
      hint?: string;
    };

    assert.equal(
      response.error,
      "Only a workspace administrator or team owner can delete this team.",
    );
    assert.equal(
      response.hint,
      "Otto's current Linear actor may need workspace-admin or team-owner permissions before retrying this team command.",
    );
  });
});

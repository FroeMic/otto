import {
  normalizeOptionalBoolean,
  normalizeOptionalString,
} from "../../client";

function assignIfPresent(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (value !== null && value !== undefined) {
    target[key] = value;
  }
}

export function buildLinearCommentCreateInput(
  argumentsObject: Record<string, unknown>,
) {
  const input: Record<string, unknown> = {
    body: normalizeOptionalString(argumentsObject.body),
    issueId: normalizeOptionalString(argumentsObject.issueIdentifierOrId),
  };

  assignIfPresent(
    input,
    "doNotSubscribeToIssue",
    normalizeOptionalBoolean(argumentsObject.doNotSubscribeToIssue),
  );
  assignIfPresent(
    input,
    "parentId",
    normalizeOptionalString(argumentsObject.parentCommentId),
  );
  assignIfPresent(
    input,
    "quotedText",
    normalizeOptionalString(argumentsObject.quotedText),
  );

  if (!input.body || !input.issueId) {
    throw new Error(
      "comment.create requires both issueIdentifierOrId and body.",
    );
  }

  return input;
}

export function buildLinearCommentUpdateInput(
  argumentsObject: Record<string, unknown>,
) {
  const input: Record<string, unknown> = {};

  assignIfPresent(input, "body", normalizeOptionalString(argumentsObject.body));
  assignIfPresent(
    input,
    "doNotSubscribeToIssue",
    normalizeOptionalBoolean(argumentsObject.doNotSubscribeToIssue),
  );
  assignIfPresent(
    input,
    "quotedText",
    normalizeOptionalString(argumentsObject.quotedText),
  );

  if (Object.keys(input).length === 0) {
    throw new Error("comment.update requires at least one field to update.");
  }

  return input;
}

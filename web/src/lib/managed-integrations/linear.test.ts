import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { LinearGraphqlError } from "@/integrations/library/linear/client";
import { searchLinearIssues } from "@/lib/managed-integrations/linear";

describe("searchLinearIssues", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("normalizes Linear issue search results", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            searchIssues: {
              totalCount: 1,
              nodes: [
                {
                  assignee: { name: "Sam" },
                  identifier: "ENG-123",
                  priority: 2,
                  project: { name: "Core" },
                  state: { name: "In Progress", type: "started" },
                  team: { key: "ENG", name: "Engineering" },
                  title: "Fix OAuth redirect bug",
                  updatedAt: "2026-04-06T18:00:00.000Z",
                  url: "https://linear.app/otto/issue/ENG-123",
                },
              ],
            },
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = await searchLinearIssues({
      accessToken: "token",
      limit: 5,
      query: "oauth",
    });

    assert.equal(result.commandKey, "issue.search");
    assert.equal(result.integrationKey, "linear");
    assert.equal(result.source, "linear");
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.identifier, "ENG-123");
    assert.equal(result.items[0]?.project, "Core");
    assert.equal(result.items[0]?.state, "In Progress");
    assert.match(requestBody, /searchIssues/);
  });

  it("surfaces provider errors", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          errors: [
            {
              message: "Invalid token",
            },
          ],
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 401,
        },
      )) as typeof fetch;

    await assert.rejects(
      () =>
        searchLinearIssues({
          accessToken: "token",
          query: "oauth",
        }),
      /Invalid token/,
    );
  });

  it("captures raw provider response details for debugging", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>gateway timeout</html>", {
        headers: {
          "Content-Type": "text/html",
        },
        status: 504,
      })) as typeof fetch;

    await assert.rejects(
      () =>
        searchLinearIssues({
          accessToken: "token",
          query: "oauth",
        }),
      (error) => {
        assert.ok(error instanceof LinearGraphqlError);
        assert.equal(error.status, 504);
        assert.equal(error.operationName, "OttoLinearIssueSearch");
        assert.match(error.rawResponseSnippet ?? "", /gateway timeout/);
        assert.match(error.variableSummary ?? "", /"term":"oauth"/);
        return true;
      },
    );
  });

  it("prefers Linear user-presentable messages when available", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          errors: [
            {
              extensions: {
                code: "FORBIDDEN",
                userPresentableMessage:
                  "You have reached the limit of teams allowed in your current plan. Please upgrade to create more teams.",
              },
              message: "Access denied",
            },
          ],
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      )) as typeof fetch;

    await assert.rejects(
      () =>
        searchLinearIssues({
          accessToken: "token",
          query: "oauth",
        }),
      (error) => {
        assert.ok(error instanceof LinearGraphqlError);
        assert.equal(error.code, "FORBIDDEN");
        assert.equal(
          error.message,
          "You have reached the limit of teams allowed in your current plan. Please upgrade to create more teams.",
        );
        assert.equal(
          error.userPresentableMessage,
          "You have reached the limit of teams allowed in your current plan. Please upgrade to create more teams.",
        );
        return true;
      },
    );
  });
});

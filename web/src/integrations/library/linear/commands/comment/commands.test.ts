import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearCommentCreate } from "./create";
import { executeLinearCommentDelete } from "./delete";
import { executeLinearCommentList } from "./list";

function buildCommentNode(overrides: Record<string, unknown> = {}) {
  return {
    body: "Hello from Otto",
    createdAt: "2026-04-07T12:00:00.000Z",
    id: "comment-1",
    issue: {
      id: "issue-uuid-1",
      identifier: "INT-6",
      title: "Track credits workflow",
    },
    issueId: "issue-uuid-1",
    parentId: null,
    quotedText: null,
    resolvedAt: null,
    updatedAt: "2026-04-07T12:05:00.000Z",
    url: "https://linear.app/otto/issue/INT-6#comment-1",
    user: {
      email: "sam@example.com",
      id: "user-1",
      name: "Sam",
    },
    ...overrides,
  };
}

describe("linear comment commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists recent comments globally", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            comments: {
              nodes: [buildCommentNode()],
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

    const result = (await executeLinearCommentList({
      arguments: {
        limit: 10,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{
        body: string;
        issue: {
          identifier: string | null;
        } | null;
      }>;
      limit: number;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        limit: number;
      };
    };

    assert.match(
      payload.query,
      /comments\(first: \$limit, orderBy: updatedAt\)/,
    );
    assert.equal(payload.variables.limit, 10);
    assert.equal(result.commandKey, "comment.list");
    assert.equal(result.limit, 10);
    assert.equal(result.items[0]?.issue?.identifier, "INT-6");
  });

  it("creates an issue comment with curated input fields", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            commentCreate: {
              comment: buildCommentNode(),
              lastSyncId: 55,
              success: true,
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

    const result = (await executeLinearCommentCreate({
      arguments: {
        body: "Hello from Otto",
        issueIdentifierOrId: "INT-6",
        quotedText: "credit",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      comment: {
        issue: {
          identifier: string | null;
        } | null;
      } | null;
      lastSyncId: number | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: {
        input: Record<string, unknown>;
      };
    };

    assert.deepEqual(payload.variables.input, {
      body: "Hello from Otto",
      issueId: "INT-6",
      quotedText: "credit",
    });
    assert.equal(result.commandKey, "comment.create");
    assert.equal(result.comment?.issue?.identifier, "INT-6");
    assert.equal(result.lastSyncId, 55);
    assert.equal(result.success, true);
  });

  it("deletes comments by comment id", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            commentDelete: {
              entityId: "comment-1",
              lastSyncId: 77,
              success: true,
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

    const result = (await executeLinearCommentDelete({
      arguments: {
        commentId: "comment-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      deletedCommentId: string;
      lastSyncId: number | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: {
        id: string;
      };
    };

    assert.equal(payload.variables.id, "comment-1");
    assert.equal(result.commandKey, "comment.delete");
    assert.equal(result.deletedCommentId, "comment-1");
    assert.equal(result.lastSyncId, 77);
    assert.equal(result.success, true);
  });
});

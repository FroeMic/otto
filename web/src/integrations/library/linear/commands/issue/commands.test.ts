import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearIssueBatchUpdate } from "./batch-update";
import { executeLinearIssueCreate } from "./create";
import { executeLinearIssueListComments } from "./list-comments";

function buildIssueNode(overrides: Record<string, unknown> = {}) {
  return {
    assignee: null,
    createdAt: "2026-04-07T10:00:00.000Z",
    description: "Issue description",
    id: "issue-uuid-1",
    identifier: "INT-6",
    labelIds: ["label-1"],
    priority: 2,
    project: {
      id: "project-1",
      name: "Core",
    },
    state: {
      id: "state-1",
      name: "Backlog",
      type: "unstarted",
    },
    team: {
      id: "team-1",
      key: "INT",
      name: "Integration",
    },
    title: "Track credits workflow",
    updatedAt: "2026-04-07T12:00:00.000Z",
    url: "https://linear.app/otto/issue/INT-6/track-credits-workflow",
    ...overrides,
  };
}

describe("linear issue commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("creates issues with a curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            issueCreate: {
              issue: buildIssueNode(),
              lastSyncId: 42,
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

    const result = (await executeLinearIssueCreate({
      arguments: {
        description: "Need a credits workflow",
        labelIds: ["label-1"],
        priority: 2,
        teamId: "team-1",
        title: "Track credits workflow",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      issue: {
        identifier: string | null;
        title: string;
      } | null;
      lastSyncId: number | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        input: Record<string, unknown>;
      };
    };

    assert.match(payload.query, /issueCreate/);
    assert.deepEqual(payload.variables.input, {
      description: "Need a credits workflow",
      labelIds: ["label-1"],
      priority: 2,
      teamId: "team-1",
      title: "Track credits workflow",
    });
    assert.equal(result.commandKey, "issue.create");
    assert.equal(result.issue?.identifier, "INT-6");
    assert.equal(result.issue?.title, "Track credits workflow");
    assert.equal(result.lastSyncId, 42);
    assert.equal(result.success, true);
  });

  it("lists issue comments after resolving an issue identifier", async () => {
    let callCount = 0;
    globalThis.fetch = (async (_input, init) => {
      callCount += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        query: string;
        variables: Record<string, unknown>;
      };

      if (body.query.includes("searchIssues")) {
        return new Response(
          JSON.stringify({
            data: {
              searchIssues: {
                nodes: [buildIssueNode()],
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
      }

      assert.match(body.query, /comments\(first: \$limit\)/);
      assert.equal(body.variables.id, "issue-uuid-1");
      assert.equal(body.variables.limit, 25);

      return new Response(
        JSON.stringify({
          data: {
            issue: {
              ...buildIssueNode(),
              comments: {
                nodes: [
                  {
                    body: "We should bill this separately.",
                    createdAt: "2026-04-07T11:00:00.000Z",
                    id: "comment-1",
                    issueId: "issue-uuid-1",
                    parentId: null,
                    quotedText: null,
                    resolvedAt: null,
                    updatedAt: "2026-04-07T11:05:00.000Z",
                    url: "https://linear.app/otto/issue/INT-6#comment-1",
                    user: {
                      email: "sam@example.com",
                      id: "user-1",
                      name: "Sam",
                    },
                  },
                ],
              },
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

    const result = (await executeLinearIssueListComments({
      arguments: {
        identifierOrId: "INT-6",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      issue: {
        identifier: string | null;
      };
      items: Array<{
        body: string;
        user: string | null;
      }>;
      totalMatched: number;
    };

    assert.equal(callCount, 2);
    assert.equal(result.commandKey, "issue.list_comments");
    assert.equal(result.issue.identifier, "INT-6");
    assert.equal(result.items[0]?.body, "We should bill this separately.");
    assert.equal(result.items[0]?.user, "Sam");
    assert.equal(result.totalMatched, 1);
  });

  it("batch updates multiple issues after resolving identifiers to ids", async () => {
    const lookups = new Map([
      ["INT-6", "issue-uuid-1"],
      ["INT-7", "issue-uuid-2"],
    ]);
    let mutationVariables: Record<string, unknown> | null = null;

    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        query: string;
        variables: Record<string, unknown>;
      };

      if (body.query.includes("searchIssues")) {
        const term = String(body.variables.term);
        const id = lookups.get(term);
        assert.ok(id);

        return new Response(
          JSON.stringify({
            data: {
              searchIssues: {
                nodes: [
                  buildIssueNode({
                    id,
                    identifier: term,
                  }),
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
      }

      mutationVariables = body.variables;

      return new Response(
        JSON.stringify({
          data: {
            issueBatchUpdate: {
              issues: [
                buildIssueNode({
                  id: "issue-uuid-1",
                  identifier: "INT-6",
                  priority: 1,
                }),
                buildIssueNode({
                  id: "issue-uuid-2",
                  identifier: "INT-7",
                  priority: 1,
                  title: "Second issue",
                }),
              ],
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

    const result = (await executeLinearIssueBatchUpdate({
      arguments: {
        identifiersOrIds: ["INT-6", "INT-7"],
        priority: 1,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{
        identifier: string | null;
        priority: number;
      }>;
      totalChanged: number;
    };

    assert.deepEqual(mutationVariables, {
      ids: ["issue-uuid-1", "issue-uuid-2"],
      input: {
        priority: 1,
      },
    });
    assert.equal(result.commandKey, "issue.batch_update");
    assert.equal(result.totalChanged, 2);
    assert.deepEqual(
      result.items.map((item) => item.identifier),
      ["INT-6", "INT-7"],
    );
    assert.deepEqual(
      result.items.map((item) => item.priority),
      [1, 1],
    );
  });
});

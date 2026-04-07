import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearUserGet } from "./get";
import { executeLinearUserListAssignedIssues } from "./list-assigned-issues";
import { executeLinearUserList } from "./list";

function buildUserNode(overrides: Record<string, unknown> = {}) {
  return {
    active: true,
    admin: false,
    displayName: "Sam",
    email: "sam@example.com",
    guest: false,
    id: "user-1",
    isAssignable: true,
    isMentionable: true,
    lastSeen: "2026-04-07T10:00:00.000Z",
    name: "Sam Example",
    owner: false,
    statusEmoji: "🚧",
    statusLabel: "Heads down",
    statusUntilAt: "2026-04-08T10:00:00.000Z",
    ...overrides,
  };
}

function buildIssueNode(overrides: Record<string, unknown> = {}) {
  return {
    assignee: buildUserNode(),
    createdAt: "2026-04-07T10:00:00.000Z",
    description: "Issue description",
    id: "issue-1",
    identifier: "INT-15",
    labelIds: ["label-1"],
    priority: 2,
    project: {
      id: "project-1",
      name: "Credits workflow",
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
    title: "Hello World",
    updatedAt: "2026-04-07T12:00:00.000Z",
    url: "https://linear.app/otto/issue/INT-15/hello-world",
    ...overrides,
  };
}

describe("linear user commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("gets one user by id", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            user: buildUserNode(),
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

    const result = (await executeLinearUserGet({
      arguments: {
        userId: "user-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lookup: string;
      user: {
        email: string | null;
        id: string | null;
        name: string;
        statusLabel: string | null;
      } | null;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        id: string;
      };
    };

    assert.match(payload.query, /query OttoLinearUserGet/);
    assert.equal(payload.variables.id, "user-1");
    assert.equal(result.commandKey, "user.get");
    assert.equal(result.lookup, "user-1");
    assert.equal(result.user?.id, "user-1");
    assert.equal(result.user?.email, "sam@example.com");
    assert.equal(result.user?.name, "Sam Example");
    assert.equal(result.user?.statusLabel, "Heads down");
  });

  it("lists users with normalized people fields", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            users: {
              nodes: [
                buildUserNode(),
                buildUserNode({
                  displayName: "Pat",
                  email: "pat@example.com",
                  id: "user-2",
                  name: "",
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
    }) as typeof fetch;

    const result = (await executeLinearUserList({
      arguments: {
        limit: 5,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{
        id: string | null;
        name: string;
      } | null>;
      limit: number;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        limit: number;
      };
    };

    assert.match(payload.query, /query OttoLinearUserList/);
    assert.equal(payload.variables.limit, 5);
    assert.equal(result.commandKey, "user.list");
    assert.equal(result.limit, 5);
    assert.equal(result.totalMatched, 2);
    assert.equal(result.items[0]?.id, "user-1");
    assert.equal(result.items[0]?.name, "Sam Example");
    assert.equal(result.items[1]?.name, "Pat");
  });

  it("lists assigned issues for one user", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            user: {
              ...buildUserNode(),
              assignedIssues: {
                nodes: [buildIssueNode()],
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

    const result = (await executeLinearUserListAssignedIssues({
      arguments: {
        limit: 10,
        userId: "user-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{
        identifier: string | null;
      }>;
      limit: number;
      lookup: string;
      totalMatched: number;
      user: {
        id: string | null;
      } | null;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        id: string;
        limit: number;
      };
    };

    assert.match(payload.query, /assignedIssues\(first: \$limit, orderBy: updatedAt\)/);
    assert.equal(payload.variables.id, "user-1");
    assert.equal(payload.variables.limit, 10);
    assert.equal(result.commandKey, "user.list_assigned_issues");
    assert.equal(result.lookup, "user-1");
    assert.equal(result.limit, 10);
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.identifier, "INT-15");
    assert.equal(result.user?.id, "user-1");
  });
});

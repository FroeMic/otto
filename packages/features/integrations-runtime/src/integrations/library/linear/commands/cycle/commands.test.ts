import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";

import { executeLinearCycleArchive } from "./archive";
import { executeLinearCycleCreate } from "./create";
import { executeLinearCycleGet } from "./get";
import { executeLinearCycleList } from "./list";
import { executeLinearCycleListIssues } from "./list-issues";
import { executeLinearCycleUpdate } from "./update";

function buildCycleNode(overrides: Record<string, unknown> = {}) {
  return {
    completedAt: null,
    createdAt: "2026-04-07T10:00:00.000Z",
    description: "Sprint for credits work",
    endsAt: "2026-04-14T00:00:00.000Z",
    id: "cycle-1",
    isActive: true,
    isFuture: false,
    isPast: false,
    name: "Cycle 42",
    number: 42,
    progress: 0.5,
    startsAt: "2026-04-07T00:00:00.000Z",
    team: {
      id: "team-1",
      key: "INT",
      name: "Integration",
    },
    ...overrides,
  };
}

describe("linear cycle commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists recent cycles with normalized metadata", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            cycles: {
              nodes: [buildCycleNode()],
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

    const result = (await executeLinearCycleList({
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
        isActive: boolean;
        name: string;
        team: string | null;
      }>;
      limit: number;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        limit: number;
      };
    };

    assert.match(payload.query, /cycles\(first: \$limit, orderBy: updatedAt\)/);
    assert.equal(payload.variables.limit, 10);
    assert.equal(result.commandKey, "cycle.list");
    assert.equal(result.limit, 10);
    assert.equal(result.items[0]?.name, "Cycle 42");
    assert.equal(result.items[0]?.team, "INT");
    assert.equal(result.items[0]?.isActive, true);
    assert.equal(result.totalMatched, 1);
  });

  it("gets one cycle by id", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            cycle: buildCycleNode(),
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

    const result = (await executeLinearCycleGet({
      arguments: {
        cycleId: "cycle-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      cycle: {
        id: string | null;
        name: string;
      } | null;
      lookup: string;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        id: string;
      };
    };

    assert.match(payload.query, /cycle\(id: \$id\)/);
    assert.equal(payload.variables.id, "cycle-1");
    assert.equal(result.commandKey, "cycle.get");
    assert.equal(result.lookup, "cycle-1");
    assert.equal(result.cycle?.id, "cycle-1");
    assert.equal(result.cycle?.name, "Cycle 42");
  });

  it("creates cycles with a curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            cycleCreate: {
              cycle: buildCycleNode(),
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

    const result = (await executeLinearCycleCreate({
      arguments: {
        description: "Sprint for credits work",
        endsAt: "2026-04-14T00:00:00.000Z",
        name: "Cycle 42",
        startsAt: "2026-04-07T00:00:00.000Z",
        teamId: "team-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      cycle: {
        name: string;
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

    assert.match(payload.query, /cycleCreate/);
    assert.deepEqual(payload.variables.input, {
      description: "Sprint for credits work",
      endsAt: "2026-04-14T00:00:00.000Z",
      name: "Cycle 42",
      startsAt: "2026-04-07T00:00:00.000Z",
      teamId: "team-1",
    });
    assert.equal(result.commandKey, "cycle.create");
    assert.equal(result.cycle?.name, "Cycle 42");
    assert.equal(result.lastSyncId, 42);
    assert.equal(result.success, true);
  });

  it("updates cycles with a curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            cycleUpdate: {
              cycle: buildCycleNode({
                description: "Updated sprint for credits work",
              }),
              lastSyncId: 44,
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

    const result = (await executeLinearCycleUpdate({
      arguments: {
        cycleId: "cycle-1",
        description: "Updated sprint for credits work",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      cycle: {
        description: string | null;
      } | null;
      lastSyncId: number | null;
      lookup: string;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        id: string;
        input: Record<string, unknown>;
      };
    };

    assert.match(payload.query, /cycleUpdate/);
    assert.equal(payload.variables.id, "cycle-1");
    assert.deepEqual(payload.variables.input, {
      description: "Updated sprint for credits work",
    });
    assert.equal(result.commandKey, "cycle.update");
    assert.equal(result.lookup, "cycle-1");
    assert.equal(result.cycle?.description, "Updated sprint for credits work");
    assert.equal(result.lastSyncId, 44);
    assert.equal(result.success, true);
  });

  it("archives cycles by cycle id", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            cycleArchive: {
              entity: buildCycleNode(),
              lastSyncId: 45,
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

    const result = (await executeLinearCycleArchive({
      arguments: {
        cycleId: "cycle-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      cycle: {
        id: string | null;
      } | null;
      lastSyncId: number | null;
      lookup: string;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        id: string;
      };
    };

    assert.match(payload.query, /cycleArchive/);
    assert.equal(payload.variables.id, "cycle-1");
    assert.equal(result.commandKey, "cycle.archive");
    assert.equal(result.lookup, "cycle-1");
    assert.equal(result.cycle?.id, "cycle-1");
    assert.equal(result.lastSyncId, 45);
    assert.equal(result.success, true);
  });

  it("lists issues for one cycle", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        query: string;
        variables: Record<string, unknown>;
      };

      assert.match(body.query, /cycle\(id: \$id\)/);
      assert.match(body.query, /issues\(first: \$limit, orderBy: updatedAt\)/);
      assert.equal(body.variables.id, "cycle-1");
      assert.equal(body.variables.limit, 25);

      return new Response(
        JSON.stringify({
          data: {
            cycle: {
              ...buildCycleNode(),
              issues: {
                nodes: [
                  {
                    assignee: null,
                    createdAt: "2026-04-07T10:00:00.000Z",
                    description: "Issue description",
                    id: "issue-uuid-1",
                    identifier: "INT-6",
                    labelIds: ["label-1"],
                    priority: 2,
                    project: null,
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

    const result = (await executeLinearCycleListIssues({
      arguments: {
        cycleId: "cycle-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      cycle: {
        id: string | null;
        name: string | null;
      };
      issue?: unknown;
      items: Array<{
        identifier: string | null;
      }>;
      lookup: string;
      totalMatched: number;
    };

    assert.equal(result.commandKey, "cycle.list_issues");
    assert.equal(result.lookup, "cycle-1");
    assert.equal(result.cycle.id, "cycle-1");
    assert.equal(result.cycle.name, "Cycle 42");
    assert.equal(result.issue, undefined);
    assert.equal(result.items[0]?.identifier, "INT-6");
    assert.equal(result.totalMatched, 1);
  });
});

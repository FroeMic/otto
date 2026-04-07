import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearCycleCreate } from "./create";
import { executeLinearCycleGet } from "./get";
import { executeLinearCycleList } from "./list";

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
});

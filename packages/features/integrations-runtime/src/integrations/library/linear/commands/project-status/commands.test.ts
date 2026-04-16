import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";

import {
  executeLinearProjectStatusCreate,
  executeLinearProjectStatusList,
} from "./commands";

function buildStatusNode(overrides: Record<string, unknown> = {}) {
  return {
    color: "#4F46E5",
    createdAt: "2026-04-07T10:00:00.000Z",
    description: "Started",
    id: "status-1",
    indefinite: false,
    name: "Started",
    position: 2,
    type: "started",
    updatedAt: "2026-04-07T12:00:00.000Z",
    ...overrides,
  };
}

describe("linear project status commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists project statuses", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            projectStatuses: {
              nodes: [buildStatusNode()],
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearProjectStatusList({
      arguments: {
        limit: 7,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{
        id: string | null;
        name: string | null;
      } | null>;
      limit: number;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { limit: number };
    };

    assert.equal(payload.variables.limit, 7);
    assert.equal(result.commandKey, "project_status.list");
    assert.equal(result.limit, 7);
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.id, "status-1");
    assert.equal(result.items[0]?.name, "Started");
  });

  it("creates project statuses", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            projectStatusCreate: {
              lastSyncId: 40,
              status: buildStatusNode(),
              success: true,
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearProjectStatusCreate({
      arguments: {
        color: "#4F46E5",
        name: "Started",
        position: 2,
        type: "started",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      status: {
        name: string | null;
      } | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: {
        input: Record<string, unknown>;
      };
    };

    assert.deepEqual(payload.variables.input, {
      color: "#4F46E5",
      description: null,
      indefinite: false,
      name: "Started",
      position: 2,
      type: "started",
    });
    assert.equal(result.commandKey, "project_status.create");
    assert.equal(result.status?.name, "Started");
    assert.equal(result.lastSyncId, 40);
    assert.equal(result.success, true);
  });
});

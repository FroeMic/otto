import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";

import {
  executeLinearCustomerStatusCreate,
  executeLinearCustomerStatusDelete,
  executeLinearCustomerStatusGet,
  executeLinearCustomerStatusList,
  executeLinearCustomerStatusUpdate,
} from "./commands";

function buildCustomerStatusNode(overrides: Record<string, unknown> = {}) {
  return {
    color: "#4F46E5",
    createdAt: "2026-04-07T10:00:00.000Z",
    description: "Active customer",
    displayName: "Active",
    id: "customer-status-1",
    name: "active",
    position: 1,
    updatedAt: "2026-04-07T12:00:00.000Z",
    ...overrides,
  };
}

describe("linear customer status commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists customer statuses", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerStatuses: {
              nodes: [buildCustomerStatusNode()],
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerStatusList({
      arguments: {
        limit: 6,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{ id: string | null; displayName: string | null }>;
      limit: number;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { limit: number };
    };

    assert.equal(payload.variables.limit, 6);
    assert.equal(result.commandKey, "customer_status.list");
    assert.equal(result.limit, 6);
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.id, "customer-status-1");
    assert.equal(result.items[0]?.displayName, "Active");
  });

  it("gets one customer status by id", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string };
      };
      assert.equal(body.variables.id, "customer-status-1");

      return new Response(
        JSON.stringify({
          data: {
            customerStatus: buildCustomerStatusNode(),
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerStatusGet({
      arguments: {
        statusId: "customer-status-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lookup: string;
      status: { id: string | null; name: string | null } | null;
    };

    assert.equal(result.commandKey, "customer_status.get");
    assert.equal(result.lookup, "customer-status-1");
    assert.equal(result.status?.id, "customer-status-1");
    assert.equal(result.status?.name, "active");
  });

  it("creates customer statuses", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerStatusCreate: {
              lastSyncId: 70,
              status: buildCustomerStatusNode(),
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

    const result = (await executeLinearCustomerStatusCreate({
      arguments: {
        color: "#4F46E5",
        displayName: "Active",
        name: "active",
        position: 1,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      status: { displayName: string | null } | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { input: Record<string, unknown> };
    };

    assert.deepEqual(payload.variables.input, {
      color: "#4F46E5",
      description: null,
      displayName: "Active",
      name: "active",
      position: 1,
    });
    assert.equal(result.commandKey, "customer_status.create");
    assert.equal(result.status?.displayName, "Active");
    assert.equal(result.lastSyncId, 70);
    assert.equal(result.success, true);
  });

  it("updates customer statuses", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerStatusUpdate: {
              lastSyncId: 71,
              status: buildCustomerStatusNode({
                displayName: "Current",
              }),
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

    const result = (await executeLinearCustomerStatusUpdate({
      arguments: {
        displayName: "Current",
        statusId: "customer-status-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      status: { displayName: string | null } | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { id: string; input: Record<string, unknown> };
    };

    assert.equal(payload.variables.id, "customer-status-1");
    assert.deepEqual(payload.variables.input, {
      color: null,
      description: null,
      displayName: "Current",
      name: null,
      position: null,
    });
    assert.equal(result.commandKey, "customer_status.update");
    assert.equal(result.status?.displayName, "Current");
    assert.equal(result.lastSyncId, 71);
    assert.equal(result.success, true);
  });

  it("deletes customer statuses", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string };
      };
      assert.equal(body.variables.id, "customer-status-1");

      return new Response(
        JSON.stringify({
          data: {
            customerStatusDelete: {
              entityId: "customer-status-1",
              lastSyncId: 72,
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

    const result = (await executeLinearCustomerStatusDelete({
      arguments: {
        statusId: "customer-status-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      deletedCustomerStatusId: string | null;
      lastSyncId: number | null;
      success: boolean;
    };

    assert.equal(result.commandKey, "customer_status.delete");
    assert.equal(result.deletedCustomerStatusId, "customer-status-1");
    assert.equal(result.lastSyncId, 72);
    assert.equal(result.success, true);
  });
});

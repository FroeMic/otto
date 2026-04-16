import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";

import {
  executeLinearCustomerTierCreate,
  executeLinearCustomerTierDelete,
  executeLinearCustomerTierGet,
  executeLinearCustomerTierList,
  executeLinearCustomerTierUpdate,
} from "./commands";

function buildCustomerTierNode(overrides: Record<string, unknown> = {}) {
  return {
    color: "#16A34A",
    createdAt: "2026-04-07T10:00:00.000Z",
    description: "Strategic customer tier",
    displayName: "Strategic",
    id: "customer-tier-1",
    name: "strategic",
    position: 1,
    updatedAt: "2026-04-07T12:00:00.000Z",
    ...overrides,
  };
}

describe("linear customer tier commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists customer tiers", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerTiers: {
              nodes: [buildCustomerTierNode()],
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerTierList({
      arguments: {
        limit: 5,
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

    assert.equal(payload.variables.limit, 5);
    assert.equal(result.commandKey, "customer_tier.list");
    assert.equal(result.limit, 5);
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.id, "customer-tier-1");
    assert.equal(result.items[0]?.displayName, "Strategic");
  });

  it("gets one customer tier by id", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string };
      };
      assert.equal(body.variables.id, "customer-tier-1");

      return new Response(
        JSON.stringify({
          data: {
            customerTier: buildCustomerTierNode(),
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerTierGet({
      arguments: {
        tierId: "customer-tier-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lookup: string;
      tier: { id: string | null; name: string | null } | null;
    };

    assert.equal(result.commandKey, "customer_tier.get");
    assert.equal(result.lookup, "customer-tier-1");
    assert.equal(result.tier?.id, "customer-tier-1");
    assert.equal(result.tier?.name, "strategic");
  });

  it("creates customer tiers", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerTierCreate: {
              lastSyncId: 80,
              success: true,
              tier: buildCustomerTierNode(),
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerTierCreate({
      arguments: {
        color: "#16A34A",
        displayName: "Strategic",
        name: "strategic",
        position: 1,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      success: boolean;
      tier: { displayName: string | null } | null;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { input: Record<string, unknown> };
    };

    assert.deepEqual(payload.variables.input, {
      color: "#16A34A",
      description: null,
      displayName: "Strategic",
      name: "strategic",
      position: 1,
    });
    assert.equal(result.commandKey, "customer_tier.create");
    assert.equal(result.tier?.displayName, "Strategic");
    assert.equal(result.lastSyncId, 80);
    assert.equal(result.success, true);
  });

  it("updates customer tiers", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerTierUpdate: {
              lastSyncId: 81,
              success: true,
              tier: buildCustomerTierNode({
                displayName: "Key",
              }),
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerTierUpdate({
      arguments: {
        displayName: "Key",
        tierId: "customer-tier-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      success: boolean;
      tier: { displayName: string | null } | null;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { id: string; input: Record<string, unknown> };
    };

    assert.equal(payload.variables.id, "customer-tier-1");
    assert.deepEqual(payload.variables.input, {
      color: null,
      description: null,
      displayName: "Key",
      name: null,
      position: null,
    });
    assert.equal(result.commandKey, "customer_tier.update");
    assert.equal(result.tier?.displayName, "Key");
    assert.equal(result.lastSyncId, 81);
    assert.equal(result.success, true);
  });

  it("deletes customer tiers", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string };
      };
      assert.equal(body.variables.id, "customer-tier-1");

      return new Response(
        JSON.stringify({
          data: {
            customerTierDelete: {
              entityId: "customer-tier-1",
              lastSyncId: 82,
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

    const result = (await executeLinearCustomerTierDelete({
      arguments: {
        tierId: "customer-tier-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      deletedCustomerTierId: string | null;
      lastSyncId: number | null;
      success: boolean;
    };

    assert.equal(result.commandKey, "customer_tier.delete");
    assert.equal(result.deletedCustomerTierId, "customer-tier-1");
    assert.equal(result.lastSyncId, 82);
    assert.equal(result.success, true);
  });
});

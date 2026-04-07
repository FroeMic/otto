import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  executeLinearCustomerCreate,
  executeLinearCustomerGet,
  executeLinearCustomerList,
  executeLinearCustomerListNeeds,
  executeLinearCustomerUpdate,
} from "./commands";

function buildCustomerNode(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: "2026-04-07T10:00:00.000Z",
    domains: ["example.com"],
    externalIds: ["crm-1"],
    id: "customer-1",
    logoUrl: "https://example.com/logo.png",
    mainSourceId: "crm-1",
    name: "Example Corp",
    owner: {
      displayName: "Sam",
      email: "sam@example.com",
      id: "user-1",
      name: "Sam Example",
    },
    revenue: 500000,
    size: 120,
    slackChannelId: "C123",
    slugId: "example-corp",
    status: {
      color: "#4F46E5",
      createdAt: "2026-04-07T10:00:00.000Z",
      description: "Active customer",
      displayName: "Active",
      id: "customer-status-1",
      name: "active",
      position: 1,
      updatedAt: "2026-04-07T12:00:00.000Z",
    },
    tier: {
      color: "#16A34A",
      createdAt: "2026-04-07T10:00:00.000Z",
      description: "Strategic customer tier",
      displayName: "Strategic",
      id: "customer-tier-1",
      name: "strategic",
      position: 1,
      updatedAt: "2026-04-07T12:00:00.000Z",
    },
    updatedAt: "2026-04-07T12:00:00.000Z",
    url: "https://linear.app/otto/customer/example-corp",
    ...overrides,
  };
}

function buildCustomerNeedNode(overrides: Record<string, unknown> = {}) {
  return {
    attachment: null,
    body: "Need better billing exports",
    createdAt: "2026-04-07T10:00:00.000Z",
    creator: {
      displayName: "Pat",
      email: "pat@example.com",
      id: "user-2",
      name: "Pat Example",
    },
    customer: {
      id: "customer-1",
      name: "Example Corp",
    },
    id: "need-1",
    issue: {
      id: "issue-1",
      identifier: "INT-15",
      title: "Hello World",
    },
    priority: 1,
    project: {
      id: "project-1",
      name: "Credits workflow",
    },
    updatedAt: "2026-04-07T12:00:00.000Z",
    url: "https://linear.app/otto/customerNeed/need-1",
    ...overrides,
  };
}

describe("linear customer commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists customers", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customers: {
              nodes: [buildCustomerNode()],
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerList({
      arguments: {
        limit: 4,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{ id: string | null; name: string }>;
      limit: number;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { limit: number };
    };

    assert.equal(payload.variables.limit, 4);
    assert.equal(result.commandKey, "customer.list");
    assert.equal(result.limit, 4);
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.id, "customer-1");
    assert.equal(result.items[0]?.name, "Example Corp");
  });

  it("gets one customer by id", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string };
      };
      assert.equal(body.variables.id, "customer-1");

      return new Response(
        JSON.stringify({
          data: {
            customer: buildCustomerNode(),
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerGet({
      arguments: {
        customerId: "customer-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      customer: {
        id: string | null;
        status: { id: string | null } | null;
      } | null;
      lookup: string;
    };

    assert.equal(result.commandKey, "customer.get");
    assert.equal(result.lookup, "customer-1");
    assert.equal(result.customer?.id, "customer-1");
    assert.equal(result.customer?.status?.id, "customer-status-1");
  });

  it("creates customers with the curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerCreate: {
              customer: buildCustomerNode(),
              lastSyncId: 90,
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

    const result = (await executeLinearCustomerCreate({
      arguments: {
        domains: ["example.com"],
        externalIds: ["crm-1"],
        name: "Example Corp",
        ownerId: "user-1",
        revenue: 500000,
        size: 120,
        statusId: "customer-status-1",
        tierId: "customer-tier-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      customer: { name: string; tier: { id: string | null } | null } | null;
      lastSyncId: number | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { input: Record<string, unknown> };
    };

    assert.deepEqual(payload.variables.input, {
      domains: ["example.com"],
      externalIds: ["crm-1"],
      logoUrl: null,
      mainSourceId: null,
      name: "Example Corp",
      ownerId: "user-1",
      revenue: 500000,
      size: 120,
      slackChannelId: null,
      statusId: "customer-status-1",
      tierId: "customer-tier-1",
    });
    assert.equal(result.commandKey, "customer.create");
    assert.equal(result.customer?.name, "Example Corp");
    assert.equal(result.customer?.tier?.id, "customer-tier-1");
    assert.equal(result.lastSyncId, 90);
    assert.equal(result.success, true);
  });

  it("updates customers with the curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerUpdate: {
              customer: buildCustomerNode({
                name: "Example Corp Updated",
              }),
              lastSyncId: 91,
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

    const result = (await executeLinearCustomerUpdate({
      arguments: {
        customerId: "customer-1",
        name: "Example Corp Updated",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      customer: { name: string } | null;
      lastSyncId: number | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { id: string; input: Record<string, unknown> };
    };

    assert.equal(payload.variables.id, "customer-1");
    assert.deepEqual(payload.variables.input, {
      domains: null,
      externalIds: null,
      logoUrl: null,
      mainSourceId: null,
      name: "Example Corp Updated",
      ownerId: null,
      revenue: null,
      size: null,
      slackChannelId: null,
      statusId: null,
      tierId: null,
    });
    assert.equal(result.commandKey, "customer.update");
    assert.equal(result.customer?.name, "Example Corp Updated");
    assert.equal(result.lastSyncId, 91);
    assert.equal(result.success, true);
  });

  it("lists customer needs for one customer", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customer: {
              ...buildCustomerNode(),
              needs: [buildCustomerNeedNode()],
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerListNeeds({
      arguments: {
        customerId: "customer-1",
        limit: 3,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      customer: { id: string | null } | null;
      items: Array<{ id: string | null; customerId: string | null }>;
      lookup: string;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { id: string };
    };

    assert.equal(payload.variables.id, "customer-1");
    assert.equal(result.commandKey, "customer.list_needs");
    assert.equal(result.lookup, "customer-1");
    assert.equal(result.customer?.id, "customer-1");
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.customerId, "customer-1");
  });
});

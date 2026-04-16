import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";

import {
  executeLinearCustomerNeedArchive,
  executeLinearCustomerNeedCreate,
  executeLinearCustomerNeedCreateFromAttachment,
  executeLinearCustomerNeedDelete,
  executeLinearCustomerNeedGet,
  executeLinearCustomerNeedList,
  executeLinearCustomerNeedUnarchive,
  executeLinearCustomerNeedUpdate,
} from "./commands";

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

describe("linear customer need commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists customer needs", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerNeeds: {
              nodes: [buildCustomerNeedNode()],
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerNeedList({
      arguments: {
        includeArchived: true,
        limit: 4,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      includeArchived: boolean;
      items: Array<{ id: string | null; customerId: string | null }>;
      limit: number;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { includeArchived: boolean; limit: number };
    };

    assert.equal(payload.variables.includeArchived, true);
    assert.equal(payload.variables.limit, 4);
    assert.equal(result.commandKey, "customer_need.list");
    assert.equal(result.includeArchived, true);
    assert.equal(result.limit, 4);
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.customerId, "customer-1");
  });

  it("gets one customer need by id", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string };
      };
      assert.equal(body.variables.id, "need-1");

      return new Response(
        JSON.stringify({
          data: {
            customerNeed: buildCustomerNeedNode(),
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerNeedGet({
      arguments: {
        needId: "need-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lookup: string;
      need: { id: string | null; customerId: string | null } | null;
    };

    assert.equal(result.commandKey, "customer_need.get");
    assert.equal(result.lookup, "need-1");
    assert.equal(result.need?.id, "need-1");
    assert.equal(result.need?.customerId, "customer-1");
  });

  it("creates customer needs", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerNeedCreate: {
              lastSyncId: 100,
              need: buildCustomerNeedNode(),
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

    const result = (await executeLinearCustomerNeedCreate({
      arguments: {
        body: "Need better billing exports",
        customerId: "customer-1",
        issueId: "INT-15",
        priority: 1,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      need: { id: string | null } | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { input: Record<string, unknown> };
    };

    assert.deepEqual(payload.variables.input, {
      body: "Need better billing exports",
      customerId: "customer-1",
      issueId: "INT-15",
      priority: 1,
    });
    assert.equal(result.commandKey, "customer_need.create");
    assert.equal(result.need?.id, "need-1");
    assert.equal(result.lastSyncId, 100);
    assert.equal(result.success, true);
  });

  it("creates customer needs from attachments", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerNeedCreateFromAttachment: {
              lastSyncId: 101,
              need: buildCustomerNeedNode(),
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

    const result = (await executeLinearCustomerNeedCreateFromAttachment({
      arguments: {
        attachmentId: "attachment-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      need: { id: string | null } | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { input: Record<string, unknown> };
    };

    assert.deepEqual(payload.variables.input, {
      attachmentId: "attachment-1",
    });
    assert.equal(result.commandKey, "customer_need.create_from_attachment");
    assert.equal(result.need?.id, "need-1");
    assert.equal(result.lastSyncId, 101);
    assert.equal(result.success, true);
  });

  it("updates customer needs", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            customerNeedUpdate: {
              lastSyncId: 102,
              need: buildCustomerNeedNode({
                body: "Need better billing exports soon",
              }),
              success: true,
              updatedRelatedNeeds: [
                buildCustomerNeedNode({
                  id: "need-2",
                }),
              ],
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearCustomerNeedUpdate({
      arguments: {
        applyPriorityToRelatedNeeds: true,
        body: "Need better billing exports soon",
        clearAttachment: true,
        needId: "need-1",
        priority: 1,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      need: { body: string | null } | null;
      success: boolean;
      updatedRelatedNeeds: Array<{ id: string | null }>;
    };

    const payload = JSON.parse(requestBody) as {
      variables: {
        clearAttachment: boolean;
        id: string;
        input: Record<string, unknown>;
      };
    };

    assert.equal(payload.variables.id, "need-1");
    assert.equal(payload.variables.clearAttachment, true);
    assert.deepEqual(payload.variables.input, {
      applyPriorityToRelatedNeeds: true,
      body: "Need better billing exports soon",
      priority: 1,
    });
    assert.equal(result.commandKey, "customer_need.update");
    assert.equal(result.need?.body, "Need better billing exports soon");
    assert.equal(result.updatedRelatedNeeds[0]?.id, "need-2");
    assert.equal(result.lastSyncId, 102);
    assert.equal(result.success, true);
  });

  it("archives and unarchives customer needs", async () => {
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;

      return new Response(
        JSON.stringify({
          data:
            requestCount === 1
              ? {
                  customerNeedArchive: {
                    entity: buildCustomerNeedNode(),
                    lastSyncId: 103,
                    success: true,
                  },
                }
              : {
                  customerNeedUnarchive: {
                    entity: buildCustomerNeedNode(),
                    lastSyncId: 104,
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

    const archived = (await executeLinearCustomerNeedArchive({
      arguments: {
        needId: "need-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      need: { id: string | null } | null;
      success: boolean;
    };
    const unarchived = (await executeLinearCustomerNeedUnarchive({
      arguments: {
        needId: "need-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      need: { id: string | null } | null;
      success: boolean;
    };

    assert.equal(archived.commandKey, "customer_need.archive");
    assert.equal(archived.need?.id, "need-1");
    assert.equal(archived.lastSyncId, 103);
    assert.equal(archived.success, true);
    assert.equal(unarchived.commandKey, "customer_need.unarchive");
    assert.equal(unarchived.need?.id, "need-1");
    assert.equal(unarchived.lastSyncId, 104);
    assert.equal(unarchived.success, true);
  });

  it("deletes customer needs", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string; keepAttachment: boolean };
      };
      assert.equal(body.variables.id, "need-1");
      assert.equal(body.variables.keepAttachment, true);

      return new Response(
        JSON.stringify({
          data: {
            customerNeedDelete: {
              entityId: "need-1",
              lastSyncId: 105,
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

    const result = (await executeLinearCustomerNeedDelete({
      arguments: {
        keepAttachment: true,
        needId: "need-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      deletedCustomerNeedId: string | null;
      lastSyncId: number | null;
      success: boolean;
    };

    assert.equal(result.commandKey, "customer_need.delete");
    assert.equal(result.deletedCustomerNeedId, "need-1");
    assert.equal(result.lastSyncId, 105);
    assert.equal(result.success, true);
  });
});

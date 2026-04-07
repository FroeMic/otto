import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  executeLinearInitiativeArchive,
  executeLinearInitiativeCreate,
  executeLinearInitiativeGet,
  executeLinearInitiativeList,
  executeLinearInitiativeListProjects,
  executeLinearInitiativeListUpdates,
  executeLinearInitiativeUpdate,
} from "./commands";

function buildInitiativeNode(overrides: Record<string, unknown> = {}) {
  return {
    color: "#4F46E5",
    completedAt: null,
    content: "# Credits roadmap",
    createdAt: "2026-04-07T10:00:00.000Z",
    creator: {
      displayName: "Sam",
      email: "sam@example.com",
      id: "user-1",
      name: "Sam Example",
    },
    description: "Expand the credits workflow",
    health: "onTrack",
    healthUpdatedAt: "2026-04-07T12:00:00.000Z",
    icon: "Target",
    id: "initiative-1",
    name: "Credits expansion",
    owner: {
      displayName: "Pat",
      email: "pat@example.com",
      id: "user-2",
      name: "Pat Example",
    },
    slugId: "credits-expansion",
    startedAt: "2026-04-01",
    status: "Active",
    targetDate: "2026-06-30",
    trashed: false,
    updatedAt: "2026-04-07T12:00:00.000Z",
    url: "https://linear.app/otto/initiative/credits-expansion",
    ...overrides,
  };
}

function buildProjectNode(overrides: Record<string, unknown> = {}) {
  return {
    color: "#5e6ad2",
    content: null,
    createdAt: "2026-04-07T10:00:00.000Z",
    description: "Ship credit workflow MVP",
    icon: "Rocket",
    id: "project-1",
    labelIds: [],
    lead: null,
    name: "Credits workflow",
    priority: 2,
    slugId: "credits-workflow",
    startDate: "2026-04-01",
    status: {
      color: "#F2994A",
      description: null,
      id: "status-1",
      name: "Backlog",
      type: "backlog",
    },
    targetDate: "2026-06-01",
    teams: {
      nodes: [
        {
          id: "team-1",
          key: "INT",
          name: "Integration",
        },
      ],
    },
    updatedAt: "2026-04-07T12:00:00.000Z",
    url: "https://linear.app/otto/project/credits-workflow",
    ...overrides,
  };
}

function buildInitiativeUpdateNode(overrides: Record<string, unknown> = {}) {
  return {
    body: "Still on track",
    createdAt: "2026-04-07T10:00:00.000Z",
    health: "onTrack",
    id: "initiative-update-1",
    initiative: {
      id: "initiative-1",
      name: "Credits expansion",
    },
    isDiffHidden: false,
    slugId: "initiative-update-1",
    updatedAt: "2026-04-07T12:00:00.000Z",
    url: "https://linear.app/otto/initiative/credits-expansion/updates#1",
    user: {
      displayName: "Sam",
      email: "sam@example.com",
      id: "user-1",
      name: "Sam Example",
    },
    ...overrides,
  };
}

describe("linear initiative commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists initiatives", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            initiatives: {
              nodes: [buildInitiativeNode()],
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearInitiativeList({
      arguments: {
        limit: 6,
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
      query: string;
      variables: { limit: number };
    };

    assert.match(
      payload.query,
      /initiatives\(first: \$limit, orderBy: updatedAt\)/,
    );
    assert.equal(payload.variables.limit, 6);
    assert.equal(result.commandKey, "initiative.list");
    assert.equal(result.limit, 6);
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.id, "initiative-1");
    assert.equal(result.items[0]?.name, "Credits expansion");
  });

  it("gets one initiative by id", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string };
      };
      assert.equal(body.variables.id, "initiative-1");

      return new Response(
        JSON.stringify({
          data: {
            initiative: buildInitiativeNode(),
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearInitiativeGet({
      arguments: {
        initiativeId: "initiative-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      initiative: { id: string | null; name: string } | null;
      lookup: string;
    };

    assert.equal(result.commandKey, "initiative.get");
    assert.equal(result.lookup, "initiative-1");
    assert.equal(result.initiative?.id, "initiative-1");
    assert.equal(result.initiative?.name, "Credits expansion");
  });

  it("creates initiatives with a curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            initiativeCreate: {
              initiative: buildInitiativeNode(),
              lastSyncId: 61,
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

    const result = (await executeLinearInitiativeCreate({
      arguments: {
        description: "Expand the credits workflow",
        name: "Credits expansion",
        ownerId: "user-2",
        status: "Active",
        targetDate: "2026-06-30",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      initiative: { name: string; ownerId: string | null } | null;
      lastSyncId: number | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { input: Record<string, unknown> };
    };

    assert.deepEqual(payload.variables.input, {
      description: "Expand the credits workflow",
      name: "Credits expansion",
      ownerId: "user-2",
      status: "Active",
      targetDate: "2026-06-30",
    });
    assert.equal(result.commandKey, "initiative.create");
    assert.equal(result.initiative?.name, "Credits expansion");
    assert.equal(result.initiative?.ownerId, "user-2");
    assert.equal(result.lastSyncId, 61);
    assert.equal(result.success, true);
  });

  it("updates initiatives with a curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            initiativeUpdate: {
              initiative: buildInitiativeNode({
                description: "Updated credits initiative",
              }),
              lastSyncId: 62,
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

    const result = (await executeLinearInitiativeUpdate({
      arguments: {
        description: "Updated credits initiative",
        initiativeId: "initiative-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      initiative: { description: string | null } | null;
      lastSyncId: number | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { id: string; input: Record<string, unknown> };
    };

    assert.equal(payload.variables.id, "initiative-1");
    assert.deepEqual(payload.variables.input, {
      description: "Updated credits initiative",
    });
    assert.equal(result.commandKey, "initiative.update");
    assert.equal(result.initiative?.description, "Updated credits initiative");
    assert.equal(result.lastSyncId, 62);
    assert.equal(result.success, true);
  });

  it("archives initiatives by id", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string };
      };
      assert.equal(body.variables.id, "initiative-1");

      return new Response(
        JSON.stringify({
          data: {
            initiativeArchive: {
              entity: buildInitiativeNode({
                trashed: true,
              }),
              lastSyncId: 63,
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

    const result = (await executeLinearInitiativeArchive({
      arguments: {
        initiativeId: "initiative-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      initiative: { trashed: boolean } | null;
      lastSyncId: number | null;
      success: boolean;
    };

    assert.equal(result.commandKey, "initiative.archive");
    assert.equal(result.initiative?.trashed, true);
    assert.equal(result.lastSyncId, 63);
    assert.equal(result.success, true);
  });

  it("lists projects for one initiative", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            initiative: {
              ...buildInitiativeNode(),
              projects: {
                nodes: [buildProjectNode()],
              },
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearInitiativeListProjects({
      arguments: {
        initiativeId: "initiative-1",
        limit: 5,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      initiative: { id: string | null } | null;
      items: Array<{ id: string | null; name: string }>;
      lookup: string;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { id: string; limit: number };
    };

    assert.equal(payload.variables.id, "initiative-1");
    assert.equal(payload.variables.limit, 5);
    assert.equal(result.commandKey, "initiative.list_projects");
    assert.equal(result.lookup, "initiative-1");
    assert.equal(result.initiative?.id, "initiative-1");
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.id, "project-1");
  });

  it("lists updates for one initiative", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            initiative: {
              ...buildInitiativeNode(),
              initiativeUpdates: {
                nodes: [buildInitiativeUpdateNode()],
              },
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearInitiativeListUpdates({
      arguments: {
        initiativeId: "initiative-1",
        limit: 4,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      initiative: { id: string | null } | null;
      items: Array<{ id: string | null; initiativeId: string | null }>;
      lookup: string;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      variables: { id: string; limit: number };
    };

    assert.equal(payload.variables.id, "initiative-1");
    assert.equal(payload.variables.limit, 4);
    assert.equal(result.commandKey, "initiative.list_updates");
    assert.equal(result.lookup, "initiative-1");
    assert.equal(result.initiative?.id, "initiative-1");
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.initiativeId, "initiative-1");
  });
});

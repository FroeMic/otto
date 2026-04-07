import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearDocumentCreate } from "./create";
import { executeLinearDocumentGet } from "./get";
import { executeLinearDocumentList } from "./list";
import { executeLinearDocumentSearch } from "./search";
import { executeLinearDocumentUpdate } from "./update";

function buildDocumentNode(overrides: Record<string, unknown> = {}) {
  return {
    color: "#4F46E5",
    content: "# Credits workflow",
    createdAt: "2026-04-07T10:00:00.000Z",
    creator: {
      displayName: "Sam",
      email: "sam@example.com",
      id: "user-1",
      name: "Sam Example",
    },
    cycle: {
      id: "cycle-1",
      name: "Cycle 3",
      number: 3,
    },
    icon: "📄",
    id: "document-1",
    initiative: {
      id: "initiative-1",
      name: "Credit expansion",
    },
    issue: {
      id: "issue-1",
      identifier: "INT-15",
      title: "Hello World",
    },
    project: {
      id: "project-1",
      name: "Credits workflow",
    },
    slugId: "credits-workflow-doc",
    sortOrder: 2,
    summary: "Credit workflow summary",
    team: {
      displayName: "Integration",
      id: "team-1",
      key: "INT",
      name: "Integration",
    },
    title: "Credits workflow doc",
    trashed: false,
    updatedAt: "2026-04-07T12:00:00.000Z",
    updatedBy: {
      displayName: "Pat",
      email: "pat@example.com",
      id: "user-2",
      name: "Pat Example",
    },
    url: "https://linear.app/otto/document/credits-workflow-doc",
    ...overrides,
  };
}

describe("linear document commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists documents", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            documents: {
              nodes: [buildDocumentNode()],
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

    const result = (await executeLinearDocumentList({
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
        title: string;
      }>;
      limit: number;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: { limit: number };
    };

    assert.match(payload.query, /documents\(first: \$limit, orderBy: updatedAt\)/);
    assert.equal(payload.variables.limit, 5);
    assert.equal(result.commandKey, "document.list");
    assert.equal(result.limit, 5);
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.id, "document-1");
    assert.equal(result.items[0]?.title, "Credits workflow doc");
  });

  it("gets one document by id", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string };
      };
      assert.equal(body.variables.id, "document-1");

      return new Response(
        JSON.stringify({
          data: {
            document: buildDocumentNode(),
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

    const result = (await executeLinearDocumentGet({
      arguments: {
        documentId: "document-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      document: {
        id: string | null;
        projectName: string | null;
      } | null;
      lookup: string;
    };

    assert.equal(result.commandKey, "document.get");
    assert.equal(result.lookup, "document-1");
    assert.equal(result.document?.id, "document-1");
    assert.equal(result.document?.projectName, "Credits workflow");
  });

  it("searches documents", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            searchDocuments: {
              nodes: [buildDocumentNode()],
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

    const result = (await executeLinearDocumentSearch({
      arguments: {
        limit: 3,
        query: "credit",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      query: string;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: { limit: number; term: string };
    };

    assert.match(payload.query, /searchDocuments\(first: \$limit, term: \$term\)/);
    assert.equal(payload.variables.limit, 3);
    assert.equal(payload.variables.term, "credit");
    assert.equal(result.commandKey, "document.search");
    assert.equal(result.query, "credit");
    assert.equal(result.totalMatched, 1);
  });

  it("creates documents with a curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            documentCreate: {
              document: buildDocumentNode(),
              lastSyncId: 12,
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

    const result = (await executeLinearDocumentCreate({
      arguments: {
        content: "# Credits workflow",
        projectId: "project-1",
        teamId: "team-1",
        title: "Credits workflow doc",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      document: {
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

    assert.match(payload.query, /documentCreate/);
    assert.deepEqual(payload.variables.input, {
      color: null,
      content: "# Credits workflow",
      cycleId: null,
      icon: null,
      initiativeId: null,
      issueId: null,
      lastAppliedTemplateId: null,
      projectId: "project-1",
      resourceFolderId: null,
      sortOrder: null,
      subscriberIds: null,
      teamId: "team-1",
      title: "Credits workflow doc",
    });
    assert.equal(result.commandKey, "document.create");
    assert.equal(result.document?.title, "Credits workflow doc");
    assert.equal(result.lastSyncId, 12);
    assert.equal(result.success, true);
  });

  it("updates documents with a curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            documentUpdate: {
              document: buildDocumentNode({
                title: "Updated doc",
              }),
              lastSyncId: 13,
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

    const result = (await executeLinearDocumentUpdate({
      arguments: {
        content: "Updated content",
        documentId: "document-1",
        title: "Updated doc",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      document: {
        title: string;
      } | null;
      lastSyncId: number | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        id: string;
        input: Record<string, unknown>;
      };
    };

    assert.match(payload.query, /documentUpdate/);
    assert.equal(payload.variables.id, "document-1");
    assert.deepEqual(payload.variables.input, {
      color: null,
      content: "Updated content",
      cycleId: null,
      hiddenAt: null,
      icon: null,
      initiativeId: null,
      issueId: null,
      lastAppliedTemplateId: null,
      projectId: null,
      resourceFolderId: null,
      sortOrder: null,
      subscriberIds: null,
      teamId: null,
      title: "Updated doc",
      trashed: null,
    });
    assert.equal(result.commandKey, "document.update");
    assert.equal(result.document?.title, "Updated doc");
    assert.equal(result.lastSyncId, 13);
    assert.equal(result.success, true);
  });
});

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  executeLinearLabelCreateIssueLabel,
  executeLinearLabelListIssueLabels,
} from "./issue";
import {
  executeLinearLabelGetProjectLabel,
  executeLinearLabelRetireProjectLabel,
} from "./project";

function buildIssueLabelNode(overrides: Record<string, unknown> = {}) {
  return {
    color: "#4F46E5",
    createdAt: "2026-04-07T10:00:00.000Z",
    creator: {
      displayName: "Sam",
      email: "sam@example.com",
      id: "user-1",
      name: "Sam Example",
    },
    description: "Customer-facing issue",
    id: "issue-label-1",
    isGroup: false,
    lastAppliedAt: "2026-04-07T12:00:00.000Z",
    name: "Customer",
    parent: null,
    retiredAt: null,
    team: {
      displayName: "Integration",
      id: "team-1",
      key: "INT",
      name: "Integration",
    },
    updatedAt: "2026-04-07T12:00:00.000Z",
    ...overrides,
  };
}

function buildProjectLabelNode(overrides: Record<string, unknown> = {}) {
  return {
    color: "#16A34A",
    createdAt: "2026-04-07T10:00:00.000Z",
    creator: {
      displayName: "Pat",
      email: "pat@example.com",
      id: "user-2",
      name: "Pat Example",
    },
    description: "Roadmap label",
    id: "project-label-1",
    isGroup: false,
    lastAppliedAt: "2026-04-07T12:00:00.000Z",
    name: "Roadmap",
    parent: null,
    retiredAt: null,
    updatedAt: "2026-04-07T12:00:00.000Z",
    ...overrides,
  };
}

describe("linear label commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists issue labels", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            issueLabels: {
              nodes: [buildIssueLabelNode()],
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

    const result = (await executeLinearLabelListIssueLabels({
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
        id: string | null;
        team: {
          key: string | null;
        } | null;
      }>;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: { limit: number };
    };

    assert.match(payload.query, /issueLabels\(first: \$limit, orderBy: updatedAt\)/);
    assert.equal(payload.variables.limit, 10);
    assert.equal(result.commandKey, "label.list_issue_labels");
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.id, "issue-label-1");
    assert.equal(result.items[0]?.team?.key, "INT");
  });

  it("creates issue labels with the curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            issueLabelCreate: {
              issueLabel: buildIssueLabelNode(),
              lastSyncId: 22,
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

    const result = (await executeLinearLabelCreateIssueLabel({
      arguments: {
        description: "Customer-facing issue",
        name: "Customer",
        replaceTeamLabels: true,
        teamId: "team-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      issueLabel: {
        name: string;
      } | null;
      lastSyncId: number | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        input: Record<string, unknown>;
        replaceTeamLabels: boolean;
      };
    };

    assert.match(payload.query, /issueLabelCreate/);
    assert.deepEqual(payload.variables.input, {
      color: null,
      description: "Customer-facing issue",
      isGroup: null,
      name: "Customer",
      parentId: null,
      retiredAt: null,
      teamId: "team-1",
    });
    assert.equal(payload.variables.replaceTeamLabels, true);
    assert.equal(result.commandKey, "label.create_issue_label");
    assert.equal(result.issueLabel?.name, "Customer");
    assert.equal(result.lastSyncId, 22);
    assert.equal(result.success, true);
  });

  it("gets project labels", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string };
      };
      assert.equal(body.variables.id, "project-label-1");

      return new Response(
        JSON.stringify({
          data: {
            projectLabel: buildProjectLabelNode(),
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

    const result = (await executeLinearLabelGetProjectLabel({
      arguments: {
        labelId: "project-label-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lookup: string;
      projectLabel: {
        name: string;
      } | null;
    };

    assert.equal(result.commandKey, "label.get_project_label");
    assert.equal(result.lookup, "project-label-1");
    assert.equal(result.projectLabel?.name, "Roadmap");
  });

  it("retires project labels", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            projectLabelRetire: {
              projectLabel: buildProjectLabelNode({
                retiredAt: "2026-04-07T15:00:00.000Z",
              }),
              lastSyncId: 23,
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

    const result = (await executeLinearLabelRetireProjectLabel({
      arguments: {
        labelId: "project-label-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      projectLabel: {
        retiredAt: string | null;
      } | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: { id: string };
    };

    assert.match(payload.query, /projectLabelRetire/);
    assert.equal(payload.variables.id, "project-label-1");
    assert.equal(result.commandKey, "label.retire_project_label");
    assert.equal(result.projectLabel?.retiredAt, "2026-04-07T15:00:00.000Z");
    assert.equal(result.lastSyncId, 23);
    assert.equal(result.success, true);
  });
});

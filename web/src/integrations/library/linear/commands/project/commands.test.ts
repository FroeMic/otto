import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearProjectCreate } from "./create";
import { executeLinearProjectCreateUpdate } from "./create-update";
import { executeLinearProjectDelete } from "./delete";
import { executeLinearProjectListIssues } from "./list-issues";
import { executeLinearProjectSearch } from "./search";

function buildProjectNode(overrides: Record<string, unknown> = {}) {
  return {
    color: "#4F46E5",
    content: "Project overview",
    createdAt: "2026-04-07T10:00:00.000Z",
    description: "Credits and billing workflow",
    icon: "💳",
    id: "project-1",
    labelIds: ["project-label-1"],
    lead: {
      email: "sam@example.com",
      id: "user-1",
      name: "Sam",
    },
    name: "Credits workflow",
    priority: 2,
    slugId: "credits-workflow",
    startDate: "2026-04-01",
    status: {
      color: "#4F46E5",
      description: "Started",
      id: "status-1",
      name: "Started",
      type: "started",
    },
    targetDate: "2026-04-30",
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

function buildIssueNode(overrides: Record<string, unknown> = {}) {
  return {
    assignee: null,
    createdAt: "2026-04-07T10:00:00.000Z",
    description: "Issue description",
    id: "issue-uuid-1",
    identifier: "INT-6",
    labelIds: ["label-1"],
    priority: 2,
    project: {
      id: "project-1",
      name: "Credits workflow",
    },
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
    ...overrides,
  };
}

describe("linear project commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("creates projects with a curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            projectCreate: {
              lastSyncId: 42,
              project: buildProjectNode(),
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

    const result = (await executeLinearProjectCreate({
      arguments: {
        description: "Credits and billing workflow",
        name: "Credits workflow",
        priority: 2,
        teamIds: ["team-1"],
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      project: {
        name: string;
        teams: string[];
      } | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        input: Record<string, unknown>;
      };
    };

    assert.match(payload.query, /projectCreate/);
    assert.deepEqual(payload.variables.input, {
      description: "Credits and billing workflow",
      name: "Credits workflow",
      priority: 2,
      teamIds: ["team-1"],
    });
    assert.equal(result.commandKey, "project.create");
    assert.equal(result.project?.name, "Credits workflow");
    assert.deepEqual(result.project?.teams, ["INT"]);
    assert.equal(result.lastSyncId, 42);
    assert.equal(result.success, true);
  });

  it("searches projects by text query", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            projects: {
              nodes: [buildProjectNode()],
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

    const result = (await executeLinearProjectSearch({
      arguments: {
        limit: 5,
        query: "credit",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{
        name: string;
      }>;
      query: string;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        limit: number;
        query: string;
      };
    };

    assert.match(payload.query, /slugId: \{ containsIgnoreCase: \$query \}/);
    assert.match(payload.query, /searchableContent: \{ contains: \$query \}/);
    assert.equal(payload.variables.limit, 5);
    assert.equal(payload.variables.query, "credit");
    assert.equal(result.commandKey, "project.search");
    assert.equal(result.query, "credit");
    assert.equal(result.items[0]?.name, "Credits workflow");
    assert.equal(result.totalMatched, 1);
  });

  it("lists project issues under one project", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        query: string;
        variables: Record<string, unknown>;
      };

      assert.match(body.query, /project\(id: \$id\)/);
      assert.match(body.query, /issues\(first: \$limit, orderBy: updatedAt\)/);
      assert.equal(body.variables.id, "project-1");
      assert.equal(body.variables.limit, 25);

      return new Response(
        JSON.stringify({
          data: {
            project: {
              ...buildProjectNode(),
              issues: {
                nodes: [buildIssueNode()],
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

    const result = (await executeLinearProjectListIssues({
      arguments: {
        projectId: "project-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{
        identifier: string | null;
      }>;
      project: {
        name: string;
      };
      totalMatched: number;
    };

    assert.equal(result.commandKey, "project.list_issues");
    assert.equal(result.project.name, "Credits workflow");
    assert.equal(result.items[0]?.identifier, "INT-6");
    assert.equal(result.totalMatched, 1);
  });

  it("creates project updates with curated input fields", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            projectUpdateCreate: {
              lastSyncId: 77,
              projectUpdate: {
                body: "Credits workflow is on track.",
                createdAt: "2026-04-07T13:00:00.000Z",
                health: "onTrack",
                id: "project-update-1",
                isDiffHidden: false,
                project: {
                  id: "project-1",
                  name: "Credits workflow",
                },
                slugId: "credits-workflow-update-1",
                updatedAt: "2026-04-07T13:00:00.000Z",
                url: "https://linear.app/otto/project-update/1",
                user: {
                  email: "sam@example.com",
                  id: "user-1",
                  name: "Sam",
                },
              },
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

    const result = (await executeLinearProjectCreateUpdate({
      arguments: {
        body: "Credits workflow is on track.",
        health: "onTrack",
        projectId: "project-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      projectUpdate: {
        health: string | null;
        projectName: string | null;
      } | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: {
        input: Record<string, unknown>;
      };
    };

    assert.deepEqual(payload.variables.input, {
      body: "Credits workflow is on track.",
      health: "onTrack",
      projectId: "project-1",
    });
    assert.equal(result.commandKey, "project.create_update");
    assert.equal(result.projectUpdate?.health, "onTrack");
    assert.equal(result.projectUpdate?.projectName, "Credits workflow");
    assert.equal(result.lastSyncId, 77);
    assert.equal(result.success, true);
  });

  it("deletes projects by id", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            projectDelete: {
              entityId: "project-1",
              lastSyncId: 59,
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

    const result = (await executeLinearProjectDelete({
      arguments: {
        projectId: "project-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      deletedProjectId: string | null;
      lastSyncId: number | null;
      lookup: string;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: { id: string };
    };

    assert.match(payload.query, /mutation OttoLinearProjectDelete/);
    assert.equal(payload.variables.id, "project-1");
    assert.equal(result.commandKey, "project.delete");
    assert.equal(result.deletedProjectId, "project-1");
    assert.equal(result.lastSyncId, 59);
    assert.equal(result.lookup, "project-1");
    assert.equal(result.success, true);
  });
});

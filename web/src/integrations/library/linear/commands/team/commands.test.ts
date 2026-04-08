import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearTeamCreate } from "./create";
import { executeLinearTeamDelete } from "./delete";
import { executeLinearTeamGet } from "./get";
import { executeLinearTeamList } from "./list";
import { executeLinearTeamListCycles } from "./list-cycles";
import { executeLinearTeamListIssues } from "./list-issues";
import { executeLinearTeamListLabels } from "./list-labels";
import { executeLinearTeamListProjects } from "./list-projects";
import { executeLinearTeamListWorkflowStates } from "./list-workflow-states";
import { executeLinearTeamUpdate } from "./update";

function buildCycleNode(overrides: Record<string, unknown> = {}) {
  return {
    completedAt: null,
    createdAt: "2026-04-08T09:00:00.000Z",
    description: "Cycle description",
    endsAt: "2026-04-20",
    id: "cycle-1",
    isActive: true,
    isFuture: false,
    isPast: false,
    name: "Cycle 5",
    number: 5,
    progress: 0.4,
    startsAt: "2026-04-06",
    team: {
      id: "team-1",
      key: "INT",
      name: "Integration",
    },
    ...overrides,
  };
}

function buildTeamNode(overrides: Record<string, unknown> = {}) {
  return {
    activeCycle: buildCycleNode(),
    archivedAt: null,
    color: "#5E6AD2",
    createdAt: "2026-04-08T08:00:00.000Z",
    cyclesEnabled: true,
    description: "Integration team",
    displayName: "Integration",
    icon: "Rocket",
    id: "team-1",
    issueCount: 12,
    key: "INT",
    name: "Integration",
    parent: null,
    private: false,
    retiredAt: null,
    triageEnabled: true,
    updatedAt: "2026-04-08T10:00:00.000Z",
    ...overrides,
  };
}

function buildWorkflowStateNode(overrides: Record<string, unknown> = {}) {
  return {
    id: "state-1",
    name: "Backlog",
    position: 1,
    team: {
      id: "team-1",
      key: "INT",
      name: "Integration",
      displayName: "Integration",
    },
    type: "unstarted",
    ...overrides,
  };
}

function buildLabelNode(overrides: Record<string, unknown> = {}) {
  return {
    color: "#5E6AD2",
    createdAt: "2026-04-08T08:00:00.000Z",
    creator: null,
    description: "Team label",
    id: "label-1",
    isGroup: false,
    lastAppliedAt: null,
    name: "cust-bug",
    parent: null,
    retiredAt: null,
    team: {
      id: "team-1",
      key: "INT",
      name: "Integration",
      displayName: "Integration",
    },
    updatedAt: "2026-04-08T09:00:00.000Z",
    ...overrides,
  };
}

function buildProjectNode(overrides: Record<string, unknown> = {}) {
  return {
    color: "#5E6AD2",
    content: null,
    createdAt: "2026-04-08T08:00:00.000Z",
    description: "Credits workflow",
    icon: "Rocket",
    id: "project-1",
    labelIds: [],
    lead: null,
    name: "Credits workflow",
    priority: 2,
    slugId: "credits-workflow",
    startDate: null,
    status: {
      color: "#F2994A",
      description: "Backlog work",
      id: "status-1",
      name: "Backlog",
      type: "backlog",
    },
    targetDate: null,
    teams: {
      nodes: [
        {
          id: "team-1",
          key: "INT",
          name: "Integration",
        },
      ],
    },
    updatedAt: "2026-04-08T09:00:00.000Z",
    url: "https://linear.app/otto/project/credits",
    ...overrides,
  };
}

function buildIssueNode(overrides: Record<string, unknown> = {}) {
  return {
    assignee: null,
    createdAt: "2026-04-08T08:00:00.000Z",
    description: "Issue description",
    id: "issue-1",
    identifier: "INT-15",
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
    title: "Hello World",
    updatedAt: "2026-04-08T10:00:00.000Z",
    url: "https://linear.app/otto/issue/INT-15/hello-world",
    ...overrides,
  };
}

function queueFetchResponses(responses: Array<Record<string, unknown>>) {
  const requestBodies: string[] = [];

  globalThis.fetch = (async (_input, init) => {
    requestBodies.push(String(init?.body ?? ""));
    const next = responses.shift();

    if (!next) {
      throw new Error("No queued Linear response left for test.");
    }

    return new Response(JSON.stringify(next), {
      headers: {
        "Content-Type": "application/json",
      },
      status: 200,
    });
  }) as typeof fetch;

  return requestBodies;
}

describe("linear team commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists teams with normalized team metadata", async () => {
    const requestBodies = queueFetchResponses([
      {
        data: {
          teams: {
            nodes: [buildTeamNode()],
          },
        },
      },
    ]);

    const result = (await executeLinearTeamList({
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
        issueCount: number;
        key: string | null;
      }>;
      limit: number;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBodies[0] ?? "{}") as {
      query: string;
      variables: { limit: number };
    };

    assert.match(payload.query, /query OttoLinearTeamList/);
    assert.equal(payload.variables.limit, 5);
    assert.equal(result.commandKey, "team.list");
    assert.equal(result.limit, 5);
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.id, "team-1");
    assert.equal(result.items[0]?.key, "INT");
    assert.equal(result.items[0]?.issueCount, 12);
  });

  it("gets one team by key", async () => {
    const requestBodies = queueFetchResponses([
      {
        data: {
          teams: {
            nodes: [buildTeamNode()],
          },
        },
      },
    ]);

    const result = (await executeLinearTeamGet({
      arguments: {
        teamIdOrKey: "INT",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lookup: string;
      team: {
        id: string | null;
        key: string | null;
        name: string;
      } | null;
    };

    const payload = JSON.parse(requestBodies[0] ?? "{}") as {
      query: string;
      variables: { lookup: string };
    };

    assert.match(payload.query, /query OttoLinearTeamByKey/);
    assert.match(payload.query, /filter: \{ key: \{ eq: \$lookup \} \}/);
    assert.doesNotMatch(payload.query, /id: \{ eq: \$lookup \}/);
    assert.equal(payload.variables.lookup, "INT");
    assert.equal(result.commandKey, "team.get");
    assert.equal(result.lookup, "INT");
    assert.equal(result.team?.id, "team-1");
    assert.equal(result.team?.key, "INT");
    assert.equal(result.team?.name, "Integration");
  });

  it("gets one team by id before falling back to key lookup", async () => {
    const requestBodies = queueFetchResponses([
      {
        data: {
          team: buildTeamNode(),
        },
      },
    ]);

    const result = (await executeLinearTeamGet({
      arguments: {
        teamIdOrKey: "6332efd5-64d0-4e60-a33f-9078e7f2620b",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lookup: string;
      team: {
        id: string | null;
        key: string | null;
      } | null;
    };

    assert.equal(requestBodies.length, 1);

    const payload = JSON.parse(requestBodies[0] ?? "{}") as {
      query: string;
      variables: { id: string };
    };

    assert.match(payload.query, /query OttoLinearTeamById/);
    assert.equal(payload.variables.id, "6332efd5-64d0-4e60-a33f-9078e7f2620b");
    assert.equal(result.commandKey, "team.get");
    assert.equal(result.lookup, "6332efd5-64d0-4e60-a33f-9078e7f2620b");
    assert.equal(result.team?.id, "team-1");
    assert.equal(result.team?.key, "INT");
  });

  it("lists cycles for one team", async () => {
    const requestBodies = queueFetchResponses([
      {
        data: {
          teams: {
            nodes: [buildTeamNode()],
          },
        },
      },
      {
        data: {
          team: {
            ...buildTeamNode(),
            cycles: {
              nodes: [buildCycleNode()],
            },
          },
        },
      },
    ]);

    const result = (await executeLinearTeamListCycles({
      arguments: {
        limit: 10,
        teamIdOrKey: "INT",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{ id: string | null }>;
      limit: number;
      lookup: string;
      team: { id: string | null } | null;
      totalMatched: number;
    };

    const listPayload = JSON.parse(requestBodies[1] ?? "{}") as {
      query: string;
      variables: { id: string; limit: number };
    };

    assert.match(listPayload.query, /query OttoLinearTeamListCycles/);
    assert.equal(listPayload.variables.id, "team-1");
    assert.equal(listPayload.variables.limit, 10);
    assert.equal(result.commandKey, "team.list_cycles");
    assert.equal(result.lookup, "INT");
    assert.equal(result.limit, 10);
    assert.equal(result.totalMatched, 1);
    assert.equal(result.team?.id, "team-1");
    assert.equal(result.items[0]?.id, "cycle-1");
  });

  it("lists workflow states for one team", async () => {
    const requestBodies = queueFetchResponses([
      {
        data: {
          teams: {
            nodes: [buildTeamNode()],
          },
        },
      },
      {
        data: {
          team: {
            ...buildTeamNode(),
            states: {
              nodes: [buildWorkflowStateNode()],
            },
          },
        },
      },
    ]);

    const result = (await executeLinearTeamListWorkflowStates({
      arguments: {
        limit: 50,
        teamIdOrKey: "INT",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{ id: string | null; teamId: string | null }>;
      limit: number;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBodies[1] ?? "{}") as {
      query: string;
      variables: { id: string; limit: number };
    };

    assert.match(payload.query, /query OttoLinearTeamListWorkflowStates/);
    assert.equal(payload.variables.id, "team-1");
    assert.equal(payload.variables.limit, 50);
    assert.equal(result.commandKey, "team.list_workflow_states");
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.id, "state-1");
    assert.equal(result.items[0]?.teamId, "team-1");
  });

  it("lists labels, projects, and issues for one team", async () => {
    const requestBodies = queueFetchResponses([
      {
        data: {
          teams: {
            nodes: [buildTeamNode()],
          },
        },
      },
      {
        data: {
          team: {
            ...buildTeamNode(),
            labels: {
              nodes: [buildLabelNode()],
            },
          },
        },
      },
      {
        data: {
          teams: {
            nodes: [buildTeamNode()],
          },
        },
      },
      {
        data: {
          team: {
            ...buildTeamNode(),
            projects: {
              nodes: [buildProjectNode()],
            },
          },
        },
      },
      {
        data: {
          teams: {
            nodes: [buildTeamNode()],
          },
        },
      },
      {
        data: {
          team: {
            ...buildTeamNode(),
            issues: {
              nodes: [buildIssueNode()],
            },
          },
        },
      },
    ]);

    const labels = (await executeLinearTeamListLabels({
      arguments: {
        limit: 25,
        teamIdOrKey: "INT",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      items: Array<{ id: string | null }>;
    };

    const projects = (await executeLinearTeamListProjects({
      arguments: {
        limit: 10,
        teamIdOrKey: "INT",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      items: Array<{ id: string | null }>;
    };

    const issues = (await executeLinearTeamListIssues({
      arguments: {
        limit: 25,
        teamIdOrKey: "INT",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      items: Array<{ id: string | null }>;
    };

    const labelPayload = JSON.parse(requestBodies[1] ?? "{}") as {
      query: string;
    };
    const projectPayload = JSON.parse(requestBodies[3] ?? "{}") as {
      query: string;
    };
    const issuePayload = JSON.parse(requestBodies[5] ?? "{}") as {
      query: string;
    };

    assert.match(labelPayload.query, /query OttoLinearTeamListLabels/);
    assert.match(projectPayload.query, /query OttoLinearTeamListProjects/);
    assert.match(issuePayload.query, /query OttoLinearTeamListIssues/);
    assert.equal(labels.items[0]?.id, "label-1");
    assert.equal(projects.items[0]?.id, "project-1");
    assert.equal(issues.items[0]?.id, "issue-1");
  });

  it("creates a team with trimmed optional fields", async () => {
    const requestBodies = queueFetchResponses([
      {
        data: {
          teamCreate: {
            lastSyncId: 123,
            success: true,
            team: buildTeamNode({
              key: "OPS",
              name: "Operations",
            }),
          },
        },
      },
    ]);

    const result = (await executeLinearTeamCreate({
      arguments: {
        color: " #111111 ",
        cyclesEnabled: true,
        description: " Ops team ",
        key: " OPS ",
        name: " Operations ",
        private: true,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      team: { key: string | null; name: string } | null;
    };

    const payload = JSON.parse(requestBodies[0] ?? "{}") as {
      variables: {
        input: Record<string, unknown>;
      };
    };

    assert.deepEqual(payload.variables.input, {
      color: "#111111",
      cyclesEnabled: true,
      description: "Ops team",
      key: "OPS",
      name: "Operations",
      private: true,
    });
    assert.equal(result.commandKey, "team.create");
    assert.equal(result.team?.key, "OPS");
    assert.equal(result.team?.name, "Operations");
  });

  it("updates a team after resolving its key", async () => {
    const requestBodies = queueFetchResponses([
      {
        data: {
          teams: {
            nodes: [buildTeamNode()],
          },
        },
      },
      {
        data: {
          teamUpdate: {
            lastSyncId: 124,
            success: true,
            team: buildTeamNode({
              description: "Updated team",
            }),
          },
        },
      },
    ]);

    const result = (await executeLinearTeamUpdate({
      arguments: {
        description: " Updated team ",
        teamIdOrKey: "INT",
        triageEnabled: false,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      team: { description: string | null; id: string | null } | null;
    };

    const payload = JSON.parse(requestBodies[1] ?? "{}") as {
      variables: {
        id: string;
        input: Record<string, unknown>;
      };
    };

    assert.equal(payload.variables.id, "team-1");
    assert.deepEqual(payload.variables.input, {
      description: "Updated team",
      triageEnabled: false,
    });
    assert.equal(result.commandKey, "team.update");
    assert.equal(result.team?.id, "team-1");
    assert.equal(result.team?.description, "Updated team");
  });

  it("deletes a team after resolving its key", async () => {
    const requestBodies = queueFetchResponses([
      {
        data: {
          teams: {
            nodes: [buildTeamNode()],
          },
        },
      },
      {
        data: {
          teamDelete: {
            entityId: "team-1",
            lastSyncId: 125,
            success: true,
          },
        },
      },
    ]);

    const result = (await executeLinearTeamDelete({
      arguments: {
        teamIdOrKey: "INT",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      deletedTeamId: string | null;
      lastSyncId: number | null;
      lookup: string;
      success: boolean;
    };

    const payload = JSON.parse(requestBodies[1] ?? "{}") as {
      query: string;
      variables: {
        id: string;
      };
    };

    assert.match(payload.query, /mutation OttoLinearTeamDelete/);
    assert.equal(payload.variables.id, "team-1");
    assert.equal(result.commandKey, "team.delete");
    assert.equal(result.deletedTeamId, "team-1");
    assert.equal(result.lastSyncId, 125);
    assert.equal(result.lookup, "INT");
    assert.equal(result.success, true);
  });
});

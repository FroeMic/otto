import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  executeLinearProjectMilestoneCreate,
  executeLinearProjectMilestoneMove,
} from "./commands";

function buildMilestoneNode(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: "2026-04-07T10:00:00.000Z",
    description: "Milestone description",
    id: "milestone-1",
    name: "GA",
    progress: 0.5,
    project: {
      id: "project-1",
      name: "Credits workflow",
    },
    status: "next",
    targetDate: "2026-05-01",
    updatedAt: "2026-04-07T12:00:00.000Z",
    ...overrides,
  };
}

describe("linear project milestone commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("creates project milestones with the curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            projectMilestoneCreate: {
              lastSyncId: 30,
              projectMilestone: buildMilestoneNode(),
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

    const result = (await executeLinearProjectMilestoneCreate({
      arguments: {
        name: "GA",
        projectId: "project-1",
        targetDate: "2026-05-01",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      milestone: {
        name: string;
      } | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      variables: {
        input: Record<string, unknown>;
      };
    };

    assert.deepEqual(payload.variables.input, {
      name: "GA",
      projectId: "project-1",
      targetDate: "2026-05-01",
    });
    assert.equal(result.commandKey, "project_milestone.create");
    assert.equal(result.milestone?.name, "GA");
    assert.equal(result.lastSyncId, 30);
    assert.equal(result.success, true);
  });

  it("moves project milestones", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            projectMilestoneMove: {
              lastSyncId: 31,
              previousIssueTeamIds: [
                {
                  issueId: "issue-1",
                  teamId: "team-1",
                },
              ],
              previousProjectTeamIds: {
                projectId: "project-1",
                teamIds: ["team-1"],
              },
              projectMilestone: buildMilestoneNode({
                project: {
                  id: "project-2",
                  name: "New project",
                },
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

    const result = (await executeLinearProjectMilestoneMove({
      arguments: {
        addIssueTeamToProject: true,
        milestoneId: "milestone-1",
        projectId: "project-2",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      milestone: {
        projectId: string | null;
      } | null;
      previousIssueTeamIds: Array<{ issueId: string | null }>;
      previousProjectTeamIds: { projectId: string | null } | null;
    };

    const payload = JSON.parse(requestBody) as {
      variables: {
        id: string;
        input: Record<string, unknown>;
      };
    };

    assert.equal(payload.variables.id, "milestone-1");
    assert.deepEqual(payload.variables.input, {
      addIssueTeamToProject: true,
      projectId: "project-2",
    });
    assert.equal(result.commandKey, "project_milestone.move");
    assert.equal(result.milestone?.projectId, "project-2");
    assert.equal(result.previousIssueTeamIds[0]?.issueId, "issue-1");
    assert.equal(result.previousProjectTeamIds?.projectId, "project-1");
  });
});

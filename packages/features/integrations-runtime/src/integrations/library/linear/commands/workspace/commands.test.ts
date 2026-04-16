import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";

import { executeLinearWorkspaceGetOrganization } from "./get-organization";
import { executeLinearWorkspaceListProjectStatuses } from "./list-project-statuses";

describe("linear workspace commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reads organization metadata", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: {
            organization: {
              createdAt: "2026-04-07T09:00:00.000Z",
              createdIssueCount: 345,
              customerCount: 12,
              id: "org-1",
              logoUrl: "https://logo.example/linear.png",
              name: "Otto",
              periodUploadVolume: 42.5,
              projectStatuses: [{ id: "ps-1" }, { id: "ps-2" }],
              roadmapEnabled: true,
              urlKey: "otto",
            },
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      )) as typeof fetch;

    const result = (await executeLinearWorkspaceGetOrganization({
      arguments: {},
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      organization: {
        name: string;
        projectStatusCount: number;
        roadmapEnabled: boolean;
        urlKey: string | null;
      };
    };

    assert.equal(result.commandKey, "workspace.get_organization");
    assert.equal(result.organization.name, "Otto");
    assert.equal(result.organization.projectStatusCount, 2);
    assert.equal(result.organization.roadmapEnabled, true);
    assert.equal(result.organization.urlKey, "otto");
  });

  it("lists project statuses with normalized metadata", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            projectStatuses: {
              nodes: [
                {
                  color: "#5E6AD2",
                  createdAt: "2026-04-07T08:00:00.000Z",
                  description: "Active delivery",
                  id: "status-1",
                  indefinite: false,
                  name: "On Track",
                  position: 1,
                  type: "onTrack",
                  updatedAt: "2026-04-07T09:00:00.000Z",
                },
              ],
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

    const result = (await executeLinearWorkspaceListProjectStatuses({
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
        color: string | null;
        name: string;
        type: string | null;
      }>;
      limit: number;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        limit: number;
      };
    };

    assert.match(payload.query, /projectStatuses/);
    assert.equal(payload.variables.limit, 10);
    assert.equal(result.commandKey, "workspace.list_project_statuses");
    assert.equal(result.limit, 10);
    assert.equal(result.items[0]?.name, "On Track");
    assert.equal(result.items[0]?.color, "#5E6AD2");
    assert.equal(result.items[0]?.type, "onTrack");
  });
});

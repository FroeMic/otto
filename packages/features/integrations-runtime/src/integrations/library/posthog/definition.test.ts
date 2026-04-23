import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

import { collectCommands } from "../../framework";
import { posthogIntegrationDefinition } from "./definition";

describe("PostHog integration definition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the initial read command catalog", () => {
    assert.equal(posthogIntegrationDefinition.key, "posthog");
    assert.deepEqual(posthogIntegrationDefinition.auth, {
      credentialType: "personal_api_key",
      kind: "api_key",
    });

    const commands = collectCommands(
      posthogIntegrationDefinition.runtimeSurface!,
    ).map((command) => command.commandKey);

    assert.deepEqual(commands.sort(), [
      "annotation.create",
      "annotation.list",
      "dashboard.get",
      "dashboard.list",
      "dashboard.run_insights",
      "experiment.archive",
      "experiment.create",
      "experiment.get",
      "experiment.list",
      "experiment.update",
      "feature_flag.activity",
      "feature_flag.archive",
      "feature_flag.create",
      "feature_flag.get",
      "feature_flag.list",
      "feature_flag.update",
      "insight.create",
      "insight.get",
      "insight.list",
      "insight.update",
      "person.list",
      "query.hogql",
      "session_recording.list",
      "taxonomy.action.list",
      "taxonomy.event_definition.list",
      "taxonomy.property_definition.list",
      "workspace.get_project",
      "workspace.list_environments",
      "workspace.list_projects",
    ]);
  });

  it("shapes project lists without returning project tokens", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              api_token: "phc_public_project_token",
              completed_snippet_onboarding: false,
              id: 153607,
              ingested_event: true,
              name: "Otto Control Plane",
              organization: "org-1",
              timezone: "Europe/Berlin",
              uuid: "project-uuid",
            },
          ],
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      ),
    );
    const command = collectCommands(
      posthogIntegrationDefinition.runtimeSurface!,
    ).find((entry) => entry.commandKey === "workspace.list_projects");

    assert.ok(command);

    const result = await command.execute({
      arguments: {},
      context: buildPostHogContext(),
    });

    assert.deepEqual(result, {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          completedSnippetOnboarding: false,
          id: "153607",
          ingestedEvent: true,
          name: "Otto Control Plane",
          organizationId: "org-1",
          timezone: "Europe/Berlin",
          uuid: "project-uuid",
        },
      ],
    });
    assert.equal(JSON.stringify(result).includes("api_token"), false);
    assert.equal(JSON.stringify(result).includes("phc_public_project_token"), false);
  });

  it("lists shaped project environments", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 42,
              name: "Production",
              project_id: 153607,
              uuid: "env-uuid",
            },
          ],
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      ),
    );
    const command = collectCommands(
      posthogIntegrationDefinition.runtimeSurface!,
    ).find((entry) => entry.commandKey === "workspace.list_environments");

    assert.ok(command);

    const result = await command.execute({
      arguments: {},
      context: buildPostHogContext(),
    });

    assert.deepEqual(result, {
      count: 1,
      next: null,
      previous: null,
      projectId: "project-1",
      results: [
        {
          id: "42",
          name: "Production",
          projectId: "153607",
          uuid: "env-uuid",
        },
      ],
    });
    assert.equal(
      String(fetch.mock.calls[0]?.[0]),
      "https://us.posthog.com/api/projects/project-1/environments/",
    );
  });

  it("publishes useful example arguments for HogQL queries", () => {
    const command = collectCommands(
      posthogIntegrationDefinition.runtimeSurface!,
    ).find((entry) => entry.commandKey === "query.hogql");

    assert.ok(command);
    assert.deepEqual(command.exampleArguments, {
      maxRows: 14,
      query:
        "SELECT toDate(timestamp) AS day, count(DISTINCT person_id) AS daily_active_users FROM events WHERE timestamp >= now() - INTERVAL 7 DAY AND person_id IS NOT NULL GROUP BY day ORDER BY day ASC",
      targetKey: "production",
    });
  });

  it("plans write commands without calling PostHog until confirmed", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("unexpected fetch"));
    const command = collectCommands(
      posthogIntegrationDefinition.runtimeSurface!,
    ).find((entry) => entry.commandKey === "feature_flag.create");

    assert.ok(command);

    const result = await command.execute({
      arguments: {
        changeReason: "Roll out the new onboarding flag.",
        payload: {
          key: "new-onboarding",
          name: "New onboarding",
        },
      },
      context: buildPostHogContext(),
    });

    assert.deepEqual(result, {
      nextArguments: {
        changeReason: "Roll out the new onboarding flag.",
        confirm: true,
        payload: {
          key: "new-onboarding",
          name: "New onboarding",
        },
      },
      planned: true,
      requiresConfirmation: true,
      summary: "Create PostHog feature flag.",
    });
    assert.equal(fetch.mock.calls.length, 0);
  });

  it("executes confirmed write commands against the selected project", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: 123, key: "new-onboarding" }), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      }),
    );
    const command = collectCommands(
      posthogIntegrationDefinition.runtimeSurface!,
    ).find((entry) => entry.commandKey === "feature_flag.create");

    assert.ok(command);

    const result = await command.execute({
      arguments: {
        changeReason: "Roll out the new onboarding flag.",
        confirm: true,
        payload: {
          key: "new-onboarding",
          name: "New onboarding",
        },
      },
      context: buildPostHogContext(),
    });

    assert.deepEqual(result, {
      id: 123,
      key: "new-onboarding",
    });
    assert.equal(
      String(fetch.mock.calls[0]?.[0]),
      "https://us.posthog.com/api/projects/project-1/feature_flags/",
    );
    assert.equal(
      (fetch.mock.calls[0]?.[1] as RequestInit | undefined)?.method,
      "POST",
    );
  });
});

function buildPostHogContext() {
  return {
    auth: {
      accessToken: undefined as never,
      apiKey: "phx_secret",
      credentialId: "credential-1",
      declaredScopes: ["feature_flag:write"],
      externalAccountLabel: "Product analytics",
      kind: "api_key" as const,
      metadata: {},
      providerKey: "posthog",
      state: {
        defaultTargetKey: "production",
        host: "https://us.posthog.com",
        targets: [
          {
            environmentId: "env-1",
            key: "production",
            label: "Production",
            organizationId: "org-1",
            projectId: "project-1",
          },
        ],
      },
      stateVersion: 1,
      status: "connected",
      tenantIntegrationId: "tenant-integration-1",
    },
    tenantIntegrationId: "tenant-integration-1",
  };
}

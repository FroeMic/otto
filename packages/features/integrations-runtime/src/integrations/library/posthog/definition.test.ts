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
      "workspace.list_projects",
    ]);
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

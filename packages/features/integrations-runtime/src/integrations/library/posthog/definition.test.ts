import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { collectCommands } from "../../framework";
import { posthogIntegrationDefinition } from "./definition";

describe("PostHog integration definition", () => {
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
      "annotation.list",
      "dashboard.get",
      "dashboard.list",
      "dashboard.run_insights",
      "experiment.get",
      "experiment.list",
      "feature_flag.activity",
      "feature_flag.get",
      "feature_flag.list",
      "insight.get",
      "insight.list",
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
});

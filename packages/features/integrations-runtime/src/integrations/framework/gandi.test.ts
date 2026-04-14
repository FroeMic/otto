import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  buildRuntimeIntegrationDetailsResponse,
  findIntegrationCommandMatches,
  getIntegrationDefinition,
  listRuntimeIntegrationDefinitions,
  listWorkspaceIntegrationDefinitions,
} from "./";

const connectedStatus = {
  connected: true,
  connectionStatus: "connected",
  enabled: true,
  integrationStatus: "connected",
  needsAttention: false,
} as const;

describe("gandi integration", () => {
  it("is registered in the workspace and runtime integration catalogs", () => {
    const workspaceDefinitions = listWorkspaceIntegrationDefinitions();
    const runtimeDefinitions = listRuntimeIntegrationDefinitions();

    assert.equal(
      workspaceDefinitions.some((definition) => definition.key === "gandi"),
      true,
    );
    assert.equal(
      runtimeDefinitions.some((definition) => definition.key === "gandi"),
      true,
    );
  });

  it("exposes the first-slice read-only domain command surface", () => {
    const definition = getIntegrationDefinition("gandi");

    assert.ok(definition?.runtimeSurface);
    assert.equal(definition.managementMode, "workspace_managed");
    assert.equal(definition.oauth, undefined);
    assert.equal(definition.runtimeSurface.commandGroups.length, 1);
    assert.deepEqual(
      definition.runtimeSurface.commandGroups[0]?.commands?.map(
        (command) => command.commandKey,
      ),
      [
        "domain.check_availability",
        "domain.batch_check",
        "domain.get_details",
        "domain.get_registration_metadata",
      ],
    );
  });

  it("returns the domain command group and command details for the plugin surface", () => {
    const definition = getIntegrationDefinition("gandi");
    assert.ok(definition?.runtimeSurface);
    const runtimeDefinition = definition as typeof definition & {
      runtimeSurface: NonNullable<typeof definition.runtimeSurface>;
    };

    const group = runtimeDefinition.runtimeSurface.commandGroups[0];
    assert.ok(group);
    assert.equal(group.groupKey, "domain");

    const command = group.commands?.find(
      (entry) => entry.commandKey === "domain.batch_check",
    );
    assert.ok(command);

    const response = buildRuntimeIntegrationDetailsResponse({
      definition: runtimeDefinition,
      detail: command,
      detailType: "command",
      status: connectedStatus,
    });

    assert.equal(response.integration.key, "gandi");
    assert.equal(response.command?.commandKey, "domain.batch_check");
    assert.equal(response.command?.inputMode, "json");
    assert.equal(response.command?.resultMode, "json");
  });

  it("surfaces gandi domain search commands for startup naming intent", () => {
    const definitions = listRuntimeIntegrationDefinitions().map((definition) => ({
      ...definition,
      status:
        definition.key === "gandi"
          ? connectedStatus
          : {
              connected: false,
              connectionStatus: null,
              enabled: false,
              integrationStatus: null,
              needsAttention: false,
            },
    }));

    const matches = findIntegrationCommandMatches({
      definitions,
      query: "evaluate startup names and check good domain options",
    });

    assert.ok(matches.length >= 1);
    assert.equal(matches[0]?.integrationKey, "gandi");
    assert.equal(matches[0]?.commandKey, "domain.batch_check");
    assert.equal(matches[0]?.connected, true);
    assert.equal(matches[0]?.needsAttention, false);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  slackFieldMeanings,
  slackSettingsExamples,
} from "@/integrations/library/slack/settings-metadata";
import {
  slackRuntimeConfigJsonSchema,
  slackRuntimeConfigUiHints,
} from "@/lib/slack-config";

import { buildRuntimeIntegrationSettingsContract } from "./settings-contract";

describe("runtime integration settings contract", () => {
  it("returns editable fields, schema, and concrete configure_integration examples", () => {
    const contract = buildRuntimeIntegrationSettingsContract({
      config: {
        ackReactionEnabled: false,
        allowedChannelIds: [],
        allowedUserIds: ["U123"],
        answerInThreads: true,
        channelAccessMode: "manual_allowlist",
        enabled: true,
        entryVersion: 7,
        installState: "installed",
        requireMentionInChannels: true,
        schemaVersion: "3",
      },
      fieldMeanings: slackFieldMeanings,
      patchSchema: slackRuntimeConfigJsonSchema,
      settingsExamples: slackSettingsExamples.map((example) => ({
        call: {
          action: example.action,
          expectedEntryVersion: example.expectedEntryVersion,
          integrationKey: "slack",
          patch: example.patch,
          summary: example.summary,
        },
        description: example.description,
      })),
      settingsLabel: "Configuration",
      uiFields:
        (slackRuntimeConfigUiHints.fields as unknown as Record<
          string,
          unknown
        >) ?? {},
      workflow: [
        'Call configure_integration with {"integrationKey":"slack","action":"get"} first.',
      ],
    });

    assert.equal(contract.settingsToolName, "configure_integration");
    assert.equal(
      contract.patchSchema.properties.ackReactionEnabled.type,
      "boolean",
    );
    assert.equal(contract.editableFields[0]?.key, "allowedUserIds");
    assert.equal(
      contract.editableFields.find(
        (field) => field.key === "ackReactionEnabled",
      )?.label,
      "Ack reaction",
    );
    assert.equal(
      contract.editableFields.find(
        (field) => field.key === "ackReactionEnabled",
      )?.currentValue,
      false,
    );
    assert.equal(contract.examples[1]?.call.action, "validate");
    assert.equal(
      contract.examples[2]?.call.expectedEntryVersion,
      "<from configure_integration action=get>",
    );
  });
});

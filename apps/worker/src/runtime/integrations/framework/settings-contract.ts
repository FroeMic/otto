import type {
  RuntimeIntegrationSettingsContract,
  RuntimeIntegrationSettingsEditableField,
  RuntimeIntegrationSettingsExample,
} from "./types";

type FieldMeaning = {
  description: string;
  key: string;
  label: string;
};

type PatchSchema = {
  additionalProperties?: boolean;
  properties?: Record<string, Record<string, unknown>>;
  type: "object";
};

export function buildRuntimeIntegrationSettingsContract(input: {
  config: Record<string, unknown>;
  fieldMeanings: FieldMeaning[];
  patchSchema: PatchSchema;
  settingsExamples: RuntimeIntegrationSettingsExample[];
  settingsLabel: string;
  uiFields: Record<string, unknown>;
  workflow: string[];
}): RuntimeIntegrationSettingsContract {
  const properties = input.patchSchema.properties ?? {};
  const fieldMeaningsByKey = new Map(
    input.fieldMeanings.map((meaning) => [meaning.key, meaning]),
  );
  const orderedKeys = [
    ...input.fieldMeanings
      .map((meaning) => meaning.key)
      .filter((key) => key in properties),
    ...Object.keys(properties).filter(
      (key) => !input.fieldMeanings.some((meaning) => meaning.key === key),
    ),
  ];

  const editableFields: RuntimeIntegrationSettingsEditableField[] =
    orderedKeys.map((key) => {
      const meaning = fieldMeaningsByKey.get(key);
      const uiHint = input.uiFields[key];

      return {
        currentValue: input.config[key],
        description: meaning?.description,
        key,
        label:
          meaning?.label ??
          (typeof uiHint === "object" &&
          uiHint &&
          "label" in (uiHint as Record<string, unknown>) &&
          typeof (uiHint as Record<string, unknown>).label === "string"
            ? ((uiHint as Record<string, unknown>).label as string)
            : key),
        schema: properties[key] ?? {},
        uiHint,
      };
    });

  return {
    editableFields,
    examples: input.settingsExamples,
    patchSchema: {
      additionalProperties: input.patchSchema.additionalProperties,
      properties,
      type: "object",
    },
    recommendedWorkflow: input.workflow,
    settingsLabel: input.settingsLabel,
    settingsToolName: "configure_integration",
  };
}

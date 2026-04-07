import { getIntegrationDefinition } from "./registry";
import type { RuntimeIntegrationManifestEntry } from "./types";

export function buildRuntimeIntegrationManifestForKeys(keys: string[]) {
  const manifest: RuntimeIntegrationManifestEntry[] = [];
  const seen = new Set<string>();

  for (const rawKey of keys) {
    const key = rawKey.trim().toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    const definition = getIntegrationDefinition(key);

    if (!definition?.runtimeTool) {
      continue;
    }

    seen.add(key);
    manifest.push({
      description: definition.description,
      key: definition.key,
      label: definition.label,
      operations: definition.runtimeTool.operations.map((operation) => ({
        description: operation.description,
        key: operation.key,
        label: operation.label,
        parametersSchema: JSON.parse(
          JSON.stringify(operation.parametersSchema),
        ),
      })),
      toolDescription: definition.runtimeTool.toolDescription,
      toolName: definition.runtimeTool.toolName,
    });
  }

  manifest.sort((left, right) => left.key.localeCompare(right.key));

  return manifest;
}

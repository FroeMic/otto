import { getIntegrationDefinition } from "./registry";
import type {
  IntegrationRuntimeCommandGroupDefinition,
  RuntimeIntegrationManifestEntry,
} from "./types";

export function buildRuntimeIntegrationManifestForKeys(keys: string[]) {
  const manifest: RuntimeIntegrationManifestEntry[] = [];
  const seen = new Set<string>();

  for (const rawKey of keys) {
    const key = rawKey.trim().toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    const definition = getIntegrationDefinition(key);

    if (!definition?.runtimeSurface) {
      continue;
    }

    seen.add(key);
    manifest.push({
      commandGroups: definition.runtimeSurface.commandGroups.map((group) => ({
        commandCount: countCommandsInGroup(group),
        groupKey: group.groupKey,
        groupPath: [...group.groupPath],
        label: group.label,
      })),
      description: definition.description,
      key: definition.key,
      label: definition.label,
      rootCommands: definition.runtimeSurface.rootCommands.map((command) => ({
        commandKey: command.commandKey,
        commandPath: [...command.commandPath],
        label: command.label,
      })),
      toolDescription: definition.runtimeSurface.toolDescription,
      toolName: definition.runtimeSurface.toolName,
    });
  }

  manifest.sort((left, right) => left.key.localeCompare(right.key));

  return manifest;
}

function countCommandsInGroup(
  group: IntegrationRuntimeCommandGroupDefinition,
): number {
  return (
    (group.commands?.length ?? 0) +
    (group.childGroups?.reduce(
      (total, childGroup) => total + countCommandsInGroup(childGroup),
      0,
    ) ?? 0)
  );
}

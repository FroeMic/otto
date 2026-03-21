import { slackToolSurfaceDefinition } from "@/tools/slack";
import type {
  ToolInstallState,
  ToolSurfaceAction,
  ToolSurfaceLifecycleState,
} from "@/tools/types";
import { webSearchToolSurfaceDefinition } from "@/tools/web-search";
import { whatsappToolSurfaceDefinition } from "@/tools/whatsapp";

const registry = [
  slackToolSurfaceDefinition,
  whatsappToolSurfaceDefinition,
  webSearchToolSurfaceDefinition,
] as const;
type ToolSurfaceRegistryEntry = (typeof registry)[number];
const registryIds = new Set<string>();
const registrySurfaceKeys = new Set<string>();

for (const definition of registry) {
  const surfaceId = getToolSurfaceId(definition.kind, definition.key);

  if (registryIds.has(definition.id)) {
    throw new Error(`Duplicate tool definition id: ${definition.id}`);
  }

  if (registrySurfaceKeys.has(surfaceId)) {
    throw new Error(`Duplicate runtime surface definition: ${surfaceId}`);
  }

  registryIds.add(definition.id);
  registrySurfaceKeys.add(surfaceId);
}

export function listToolDefinitions() {
  return [...registry];
}

export function getToolDefinition(surfaceKind: string, surfaceKey: string) {
  return (
    registry.find(
      (entry) => entry.kind === surfaceKind && entry.key === surfaceKey,
    ) ?? null
  );
}

export function getToolSurfaceId(surfaceKind: string, surfaceKey: string) {
  return `${surfaceKind}:${surfaceKey}`;
}

export function listAvailableToolActions(
  definition: ToolSurfaceRegistryEntry,
  state: ToolSurfaceLifecycleState,
) {
  const actions: ToolSurfaceAction[] = [];

  if (definition.supportsInstall && state.installState === "uninstalled") {
    actions.push("install");
    return actions;
  }

  if (state.installState !== "installed") {
    return actions;
  }

  if (definition.supportsConfig) {
    actions.push("update");
  }

  if (definition.supportsEnable) {
    actions.push(state.enabled ? "disable" : "enable");
  }

  if (definition.supportsInstall) {
    actions.push("uninstall");
  }

  if (definition.supportsReapply) {
    actions.push("reapply");
  }

  return actions;
}

export function normalizeInstallState(value: string | null | undefined) {
  return value === "uninstalled"
    ? ("uninstalled" as ToolInstallState)
    : ("installed" as ToolInstallState);
}

import { redirect } from "next/navigation";

import { getIntegrationDefinition } from "@/integrations/framework";
import { buildIntegrationSectionPath } from "@/integrations/framework/routing";
import {
  parseWebSearchRuntimeConfig,
  resolveRuntimeWebSearchConfig,
  webSearchRuntimeConfigJsonSchema,
  webSearchRuntimeConfigUiHints,
} from "@/lib/web-search-config";
import type { ToolSurfaceResponse } from "@/tools/types";
import { WebSearchToolPage } from "@/tools/web-search/page";

import {
  braveAgentCapabilities,
  braveFieldMeanings,
} from "../settings-metadata";

export async function BraveManagedIntegrationPage({
  orgSlug,
  section,
}: {
  orgSlug: string;
  section: string | null;
  userExternalId: string;
}) {
  const definition = getIntegrationDefinition("brave");

  if (!definition) {
    throw new Error("Integration definition for Brave is missing.");
  }

  if (section && section !== "status") {
    redirect(
      buildIntegrationSectionPath({
        integrationKey: definition.key,
        orgSlug,
        section: "status",
      }),
    );
  }

  const resolved = resolveRuntimeWebSearchConfig();
  const braveIsSelected = resolved.surfaceConfig.provider === "brave";
  const surface = {
    actionMeanings: [],
    agentCapabilities: braveAgentCapabilities,
    agentOperations: [],
    allowedActions: [],
    availability: resolved.enabled && braveIsSelected ? "available" : "blocked",
    blockingReason:
      resolved.enabled && !braveIsSelected
        ? "Brave is not the active managed web-search provider in the workspace app."
        : resolved.reason,
    canAgentEdit: false,
    canUserEdit: false,
    config: {
      ...parseWebSearchRuntimeConfig(resolved.surfaceConfig),
      enabled: true,
      entryVersion: 1,
      installState: "installed",
      schemaVersion: "1",
    },
    description: definition.pageDescription,
    fieldMeanings: [...braveFieldMeanings],
    id: "brave",
    key: "brave",
    kind: "integration",
    label: definition.label,
    options: {},
    schema: webSearchRuntimeConfigJsonSchema,
    settingsUrl: definition.settingsPath(orgSlug),
    surfaceType: "integration",
    uiGroup: "integrations",
    uiHints: webSearchRuntimeConfigUiHints,
  } satisfies ToolSurfaceResponse<
    ReturnType<typeof parseWebSearchRuntimeConfig>
  >;

  return <WebSearchToolPage orgSlug={orgSlug} surface={surface} />;
}

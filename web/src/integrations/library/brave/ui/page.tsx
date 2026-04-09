import { redirect } from "next/navigation";

import { getIntegrationDefinition } from "@/integrations/framework";
import { buildIntegrationSectionPath } from "@/integrations/framework/routing";
import {
  parseWebSearchRuntimeConfig,
  resolveRuntimeWebSearchConfig,
} from "@/lib/web-search-config";

import { braveAgentCapabilities } from "../settings-metadata";
import { BraveConfigPage, type BraveConfigSurface } from "./brave-config-page";

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
  const surface: BraveConfigSurface = {
    agentCapabilities: braveAgentCapabilities,
    availability: resolved.enabled && braveIsSelected ? "available" : "blocked",
    blockingReason:
      resolved.enabled && !braveIsSelected
        ? "Brave is not the active managed web-search provider in the workspace app."
        : resolved.reason,
    canAgentEdit: false,
    canUserEdit: false,
    config: parseWebSearchRuntimeConfig(resolved.surfaceConfig),
    description: definition.pageDescription,
    label: definition.label,
  };

  return <BraveConfigPage surface={surface} />;
}

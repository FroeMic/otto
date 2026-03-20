import {
  getDefaultWebSearchRuntimeConfig,
  parseWebSearchRuntimeConfig,
  WEB_SEARCH_TOOL_DESCRIPTION,
  WEB_SEARCH_TOOL_LABEL,
  WEB_SEARCH_TOOL_SCHEMA_SOURCE,
  WEB_SEARCH_TOOL_SCHEMA_VERSION,
  WEB_SEARCH_TOOL_SURFACE_KEY,
  WEB_SEARCH_TOOL_SURFACE_KIND,
  type WebSearchRuntimeConfig,
  webSearchRuntimeConfigJsonSchema,
  webSearchRuntimeConfigPatchSchema,
  webSearchRuntimeConfigUiHints,
} from "@/lib/web-search-config";
import type {
  ToolActionMeaning,
  ToolAgentOperation,
  ToolFieldMeaning,
  ToolSurfaceDefinition,
} from "@/tools/types";
import { WebSearchToolPage } from "@/tools/web-search/page";

const fieldMeanings: ToolFieldMeaning[] = [
  {
    description:
      "The OpenClaw web_search provider Otto projects into the tenant runtime.",
    key: "provider",
    label: "Provider",
  },
  {
    description:
      "The runtime environment variable Otto populates with the provider API key. The secret value itself is never exposed through this surface.",
    key: "credentialEnvVar",
    label: "Credential env var",
  },
  {
    description:
      "Default result count Otto passes to OpenClaw when web_search is enabled.",
    key: "maxResults",
    label: "Default results",
  },
  {
    description: "Request timeout Otto projects for web_search.",
    key: "timeoutSeconds",
    label: "Timeout",
  },
  {
    description: "Cache lifetime Otto projects for web_search results.",
    key: "cacheTtlMinutes",
    label: "Cache TTL",
  },
];

const agentOperations: ToolAgentOperation[] = [
  {
    description:
      "Read the current global web search configuration Otto projects into the runtime. This surface is read-only.",
    key: "get_web_search_config",
    label: "Get web search config",
  },
];

const actionMeanings: ToolActionMeaning[] = [];

export const webSearchToolSurfaceDefinition: ToolSurfaceDefinition<
  WebSearchRuntimeConfig,
  Record<string, never>
> = {
  actionMeanings,
  agentOperations,
  async buildOptions() {
    return {};
  },
  description: WEB_SEARCH_TOOL_DESCRIPTION,
  fieldMeanings,
  getDefaultConfig: getDefaultWebSearchRuntimeConfig,
  id: "web-search",
  installSource: "registry",
  key: WEB_SEARCH_TOOL_SURFACE_KEY,
  kind: WEB_SEARCH_TOOL_SURFACE_KIND,
  label: WEB_SEARCH_TOOL_LABEL,
  parseConfig: parseWebSearchRuntimeConfig,
  parsePatch: (value) => webSearchRuntimeConfigPatchSchema.parse(value),
  renderPage: WebSearchToolPage,
  schema: webSearchRuntimeConfigJsonSchema,
  schemaSource: WEB_SEARCH_TOOL_SCHEMA_SOURCE,
  schemaVersion: WEB_SEARCH_TOOL_SCHEMA_VERSION,
  scope: "tenant",
  surfaceType: "global",
  supportsConfig: false,
  supportsEnable: false,
  supportsInstall: false,
  supportsReapply: false,
  uiGroup: "tools",
  uiHints: webSearchRuntimeConfigUiHints,
  async validateSemantic() {},
};

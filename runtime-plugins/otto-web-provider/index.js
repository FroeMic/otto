import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import {
  postTrustedWebToolsJson,
  resolveSearchTimeoutSeconds,
} from "openclaw/plugin-sdk/provider-web-search";

const PROVIDER_ID = "otto-web-search";
const PROXY_PATH = "/api/internal/runtime/web-search/search";

export default definePluginEntry({
  id: "otto-web-provider",
  name: "Otto Web Provider",
  description: "Otto-managed web search provider proxy",
  register(api) {
    api.registerWebSearchProvider({
      id: PROVIDER_ID,
      label: "Otto Web Search",
      hint: "Otto-managed Brave web search proxy",
      envVars: [],
      placeholder: "",
      signupUrl: "https://docs.openclaw.ai/tools/web",
      credentialPath: "tools.web.search.ottoProxy.disabled",
      getCredentialValue: () => undefined,
      setCredentialValue() {},
      createTool: (ctx) => ({
        description:
          "Search the web through Otto's managed web-search proxy. Otto keeps provider credentials in the workspace app and does not expose them to the runtime.",
        parameters: {
          additionalProperties: false,
          properties: {
            count: {
              maximum: 10,
              minimum: 1,
              type: "number",
            },
            country: {
              type: "string",
            },
            date_after: {
              type: "string",
            },
            date_before: {
              type: "string",
            },
            freshness: {
              type: "string",
            },
            language: {
              type: "string",
            },
            query: {
              type: "string",
            },
            search_lang: {
              type: "string",
            },
            ui_lang: {
              type: "string",
            },
          },
          required: ["query"],
          type: "object",
        },
        execute: async (args) => {
          const controlPlaneBaseUrl = normalizeControlPlaneBaseUrl(
            process.env.OTTO_CONTROL_PLANE_BASE_URL,
          );
          const tenantToken = normalizeSecret(process.env.TENANT_TOKEN);

          if (!controlPlaneBaseUrl || !tenantToken) {
            return {
              docs: "https://docs.openclaw.ai/tools/web",
              error: "missing_otto_web_proxy_config",
              message:
                "OTTO_CONTROL_PLANE_BASE_URL and TENANT_TOKEN are required to use Otto-managed web search.",
            };
          }

          return await postTrustedWebToolsJson(
            {
              apiKey: tenantToken,
              body: args,
              errorLabel: "Otto web search proxy",
              timeoutSeconds: resolveSearchTimeoutSeconds(ctx.searchConfig),
              url: `${controlPlaneBaseUrl}${PROXY_PATH}`,
            },
            async (response) => await response.json(),
          );
        },
      }),
    });
  },
});

function normalizeControlPlaneBaseUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}

function normalizeSecret(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

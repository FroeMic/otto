import { z } from "zod";

import { getEnv } from "./env";

export const WEB_SEARCH_CONFIG_SCHEMA_VERSION = "1";
export const WEB_SEARCH_LABEL = "Web Search";
export const WEB_SEARCH_DESCRIPTION =
  "Let Otto search the web using a managed provider.";

const webSearchProviderSchema = z.enum([
  "brave",
  "gemini",
  "grok",
  "kimi",
  "perplexity",
]);
const braveModeSchema = z.enum(["web", "llm-context"]);

export type WebSearchProvider = z.infer<typeof webSearchProviderSchema>;
export type WebSearchBraveMode = z.infer<typeof braveModeSchema>;

const webSearchRuntimeConfigObjectSchema = z
  .object({
    braveMode: braveModeSchema.optional(),
    cacheTtlMinutes: z.number().int().nonnegative().optional(),
    credentialEnvVar: z.string().trim().min(1).nullable().default(null),
    geminiModel: z.string().trim().min(1).optional(),
    grokInlineCitations: z.boolean().optional(),
    grokModel: z.string().trim().min(1).optional(),
    kimiBaseUrl: z.string().trim().min(1).optional(),
    kimiModel: z.string().trim().min(1).optional(),
    managedBy: z.literal("control_plane_env").default("control_plane_env"),
    maxResults: z.number().int().positive().max(10).optional(),
    perplexityBaseUrl: z.string().trim().min(1).optional(),
    perplexityModel: z.string().trim().min(1).optional(),
    provider: webSearchProviderSchema.nullable().default(null),
    timeoutSeconds: z.number().int().positive().optional(),
  })
  .strict()
  .transform((value) => ({
    ...value,
    provider: value.provider,
  }));

export const webSearchRuntimeConfigSchema = webSearchRuntimeConfigObjectSchema;
export type WebSearchRuntimeConfig = z.infer<
  typeof webSearchRuntimeConfigSchema
>;

export type OpenClawWebSearchConfig = {
  brave?: {
    mode?: WebSearchBraveMode;
  };
  cacheTtlMinutes?: number;
  enabled: true;
  gemini?: {
    model?: string;
  };
  grok?: {
    inlineCitations?: boolean;
    model?: string;
  };
  kimi?: {
    baseUrl?: string;
    model?: string;
  };
  maxResults?: number;
  perplexity?: {
    baseUrl?: string;
    model?: string;
  };
  provider: WebSearchProvider;
  timeoutSeconds?: number;
};

export type ResolvedRuntimeWebSearchConfig = {
  enabled: boolean;
  envLines: string[];
  openClawConfig: OpenClawWebSearchConfig | null;
  reason: string | null;
  surfaceConfig: WebSearchRuntimeConfig;
};

export const webSearchRuntimeConfigPatchSchema = z.object({}).strict();

export const webSearchRuntimeConfigJsonSchema = {
  additionalProperties: false,
  properties: {
    braveMode: {
      enum: ["web", "llm-context"],
      type: "string",
    },
    cacheTtlMinutes: {
      minimum: 0,
      type: "integer",
    },
    credentialEnvVar: {
      type: ["string", "null"],
    },
    geminiModel: {
      type: "string",
    },
    grokInlineCitations: {
      type: "boolean",
    },
    grokModel: {
      type: "string",
    },
    kimiBaseUrl: {
      type: "string",
    },
    kimiModel: {
      type: "string",
    },
    managedBy: {
      const: "control_plane_env",
      type: "string",
    },
    maxResults: {
      maximum: 10,
      minimum: 1,
      type: "integer",
    },
    perplexityBaseUrl: {
      type: "string",
    },
    perplexityModel: {
      type: "string",
    },
    provider: {
      enum: ["brave", "gemini", "grok", "kimi", "perplexity", null],
    },
    timeoutSeconds: {
      minimum: 1,
      type: "integer",
    },
  },
  type: "object",
} as const;

export const webSearchRuntimeConfigUiHints = {
  description: WEB_SEARCH_DESCRIPTION,
  fields: {
    braveMode: {
      kind: "enum",
      label: "Brave mode",
    },
    cacheTtlMinutes: {
      kind: "number",
      label: "Cache TTL (min)",
      readOnly: true,
    },
    credentialEnvVar: {
      kind: "text",
      label: "Credential env var",
      readOnly: true,
    },
    geminiModel: {
      kind: "text",
      label: "Gemini model",
      readOnly: true,
    },
    grokInlineCitations: {
      kind: "boolean",
      label: "Grok inline citations",
      readOnly: true,
    },
    grokModel: {
      kind: "text",
      label: "Grok model",
      readOnly: true,
    },
    kimiBaseUrl: {
      kind: "text",
      label: "Kimi base URL",
      readOnly: true,
    },
    kimiModel: {
      kind: "text",
      label: "Kimi model",
      readOnly: true,
    },
    managedBy: {
      kind: "text",
      label: "Managed by",
      readOnly: true,
    },
    maxResults: {
      kind: "number",
      label: "Default results",
      readOnly: true,
    },
    perplexityBaseUrl: {
      kind: "text",
      label: "Perplexity base URL",
      readOnly: true,
    },
    perplexityModel: {
      kind: "text",
      label: "Perplexity model",
      readOnly: true,
    },
    provider: {
      kind: "enum",
      label: "Provider",
      readOnly: true,
    },
    timeoutSeconds: {
      kind: "number",
      label: "Timeout (sec)",
      readOnly: true,
    },
  },
  label: WEB_SEARCH_LABEL,
  readOnly: true,
} as const;

export function getDefaultWebSearchRuntimeConfig(): WebSearchRuntimeConfig {
  return webSearchRuntimeConfigSchema.parse({});
}

export function parseWebSearchRuntimeConfig(
  value: unknown,
): WebSearchRuntimeConfig {
  return webSearchRuntimeConfigSchema.parse(value);
}

export function resolveRuntimeWebSearchConfig(): ResolvedRuntimeWebSearchConfig {
  const env = getEnv();
  const provider = env.RUNTIME_WEB_SEARCH_PROVIDER ?? null;
  const baseSurfaceConfig = {
    managedBy: "control_plane_env" as const,
    ...(typeof env.RUNTIME_WEB_SEARCH_MAX_RESULTS === "number"
      ? {
          maxResults: env.RUNTIME_WEB_SEARCH_MAX_RESULTS,
        }
      : {}),
    ...(typeof env.RUNTIME_WEB_SEARCH_TIMEOUT_SECONDS === "number"
      ? {
          timeoutSeconds: env.RUNTIME_WEB_SEARCH_TIMEOUT_SECONDS,
        }
      : {}),
    ...(typeof env.RUNTIME_WEB_SEARCH_CACHE_TTL_MINUTES === "number"
      ? {
          cacheTtlMinutes: env.RUNTIME_WEB_SEARCH_CACHE_TTL_MINUTES,
        }
      : {}),
  };

  if (!provider) {
    return {
      enabled: false,
      envLines: [],
      openClawConfig: null,
      reason:
        "Web search is unavailable because RUNTIME_WEB_SEARCH_PROVIDER is not configured in the workspace app.",
      surfaceConfig: parseWebSearchRuntimeConfig(baseSurfaceConfig),
    };
  }

  const sharedConfig = {
    provider,
    ...baseSurfaceConfig,
  } as const;
  const openClawConfig: OpenClawWebSearchConfig = {
    enabled: true,
    provider,
    ...(typeof env.RUNTIME_WEB_SEARCH_MAX_RESULTS === "number"
      ? {
          maxResults: env.RUNTIME_WEB_SEARCH_MAX_RESULTS,
        }
      : {}),
    ...(typeof env.RUNTIME_WEB_SEARCH_TIMEOUT_SECONDS === "number"
      ? {
          timeoutSeconds: env.RUNTIME_WEB_SEARCH_TIMEOUT_SECONDS,
        }
      : {}),
    ...(typeof env.RUNTIME_WEB_SEARCH_CACHE_TTL_MINUTES === "number"
      ? {
          cacheTtlMinutes: env.RUNTIME_WEB_SEARCH_CACHE_TTL_MINUTES,
        }
      : {}),
  };

  switch (provider) {
    case "brave":
      return buildResolvedConfig({
        baseSurfaceConfig: sharedConfig,
        credentialEnvVar: "RUNTIME_BRAVE_API_KEY",
        credentialValue: env.RUNTIME_BRAVE_API_KEY,
        openClawConfig: {
          ...openClawConfig,
          ...(env.RUNTIME_WEB_SEARCH_BRAVE_MODE
            ? {
                brave: {
                  mode: env.RUNTIME_WEB_SEARCH_BRAVE_MODE,
                },
              }
            : {}),
        },
        providerSurfaceConfig: env.RUNTIME_WEB_SEARCH_BRAVE_MODE
          ? {
              braveMode: env.RUNTIME_WEB_SEARCH_BRAVE_MODE,
            }
          : {},
        provider,
      });
    case "gemini":
      return buildResolvedConfig({
        baseSurfaceConfig: sharedConfig,
        credentialEnvVar: "RUNTIME_GEMINI_API_KEY",
        credentialValue: env.RUNTIME_GEMINI_API_KEY,
        openClawConfig: {
          ...openClawConfig,
          ...(env.RUNTIME_WEB_SEARCH_GEMINI_MODEL
            ? {
                gemini: {
                  model: env.RUNTIME_WEB_SEARCH_GEMINI_MODEL,
                },
              }
            : {}),
        },
        providerSurfaceConfig: env.RUNTIME_WEB_SEARCH_GEMINI_MODEL
          ? {
              geminiModel: env.RUNTIME_WEB_SEARCH_GEMINI_MODEL,
            }
          : {},
        provider,
      });
    case "grok":
      return buildResolvedConfig({
        baseSurfaceConfig: sharedConfig,
        credentialEnvVar: "RUNTIME_XAI_API_KEY",
        credentialValue: env.RUNTIME_XAI_API_KEY,
        openClawConfig: {
          ...openClawConfig,
          ...(env.RUNTIME_WEB_SEARCH_GROK_MODEL ||
          env.RUNTIME_WEB_SEARCH_GROK_INLINE_CITATIONS !== undefined
            ? {
                grok: {
                  ...(env.RUNTIME_WEB_SEARCH_GROK_MODEL
                    ? {
                        model: env.RUNTIME_WEB_SEARCH_GROK_MODEL,
                      }
                    : {}),
                  ...(env.RUNTIME_WEB_SEARCH_GROK_INLINE_CITATIONS !== undefined
                    ? {
                        inlineCitations:
                          env.RUNTIME_WEB_SEARCH_GROK_INLINE_CITATIONS,
                      }
                    : {}),
                },
              }
            : {}),
        },
        providerSurfaceConfig: {
          ...(env.RUNTIME_WEB_SEARCH_GROK_MODEL
            ? {
                grokModel: env.RUNTIME_WEB_SEARCH_GROK_MODEL,
              }
            : {}),
          ...(env.RUNTIME_WEB_SEARCH_GROK_INLINE_CITATIONS !== undefined
            ? {
                grokInlineCitations:
                  env.RUNTIME_WEB_SEARCH_GROK_INLINE_CITATIONS,
              }
            : {}),
        },
        provider,
      });
    case "kimi": {
      const credentialEnvVar = env.RUNTIME_KIMI_API_KEY
        ? "RUNTIME_KIMI_API_KEY"
        : env.RUNTIME_MOONSHOT_API_KEY
          ? "RUNTIME_MOONSHOT_API_KEY"
          : null;
      const credentialValue =
        env.RUNTIME_KIMI_API_KEY ?? env.RUNTIME_MOONSHOT_API_KEY;

      return buildResolvedConfig({
        baseSurfaceConfig: sharedConfig,
        credentialEnvVar,
        credentialValue,
        openClawConfig: {
          ...openClawConfig,
          ...(env.RUNTIME_WEB_SEARCH_KIMI_BASE_URL ||
          env.RUNTIME_WEB_SEARCH_KIMI_MODEL
            ? {
                kimi: {
                  ...(env.RUNTIME_WEB_SEARCH_KIMI_BASE_URL
                    ? {
                        baseUrl: env.RUNTIME_WEB_SEARCH_KIMI_BASE_URL,
                      }
                    : {}),
                  ...(env.RUNTIME_WEB_SEARCH_KIMI_MODEL
                    ? {
                        model: env.RUNTIME_WEB_SEARCH_KIMI_MODEL,
                      }
                    : {}),
                },
              }
            : {}),
        },
        providerSurfaceConfig: {
          ...(env.RUNTIME_WEB_SEARCH_KIMI_BASE_URL
            ? {
                kimiBaseUrl: env.RUNTIME_WEB_SEARCH_KIMI_BASE_URL,
              }
            : {}),
          ...(env.RUNTIME_WEB_SEARCH_KIMI_MODEL
            ? {
                kimiModel: env.RUNTIME_WEB_SEARCH_KIMI_MODEL,
              }
            : {}),
        },
        provider,
      });
    }
    case "perplexity": {
      const credentialEnvVar = env.RUNTIME_PERPLEXITY_API_KEY
        ? "RUNTIME_PERPLEXITY_API_KEY"
        : env.RUNTIME_OPENROUTER_API_KEY
          ? "RUNTIME_OPENROUTER_API_KEY"
          : null;
      const credentialValue =
        env.RUNTIME_PERPLEXITY_API_KEY ?? env.RUNTIME_OPENROUTER_API_KEY;

      return buildResolvedConfig({
        baseSurfaceConfig: sharedConfig,
        credentialEnvVar,
        credentialValue,
        openClawConfig: {
          ...openClawConfig,
          ...(env.RUNTIME_WEB_SEARCH_PERPLEXITY_BASE_URL ||
          env.RUNTIME_WEB_SEARCH_PERPLEXITY_MODEL
            ? {
                perplexity: {
                  ...(env.RUNTIME_WEB_SEARCH_PERPLEXITY_BASE_URL
                    ? {
                        baseUrl: env.RUNTIME_WEB_SEARCH_PERPLEXITY_BASE_URL,
                      }
                    : {}),
                  ...(env.RUNTIME_WEB_SEARCH_PERPLEXITY_MODEL
                    ? {
                        model: env.RUNTIME_WEB_SEARCH_PERPLEXITY_MODEL,
                      }
                    : {}),
                },
              }
            : {}),
        },
        providerSurfaceConfig: {
          ...(env.RUNTIME_WEB_SEARCH_PERPLEXITY_BASE_URL
            ? {
                perplexityBaseUrl: env.RUNTIME_WEB_SEARCH_PERPLEXITY_BASE_URL,
              }
            : {}),
          ...(env.RUNTIME_WEB_SEARCH_PERPLEXITY_MODEL
            ? {
                perplexityModel: env.RUNTIME_WEB_SEARCH_PERPLEXITY_MODEL,
              }
            : {}),
        },
        provider,
      });
    }
  }
}

function buildResolvedConfig(input: {
  baseSurfaceConfig: Record<string, unknown>;
  credentialEnvVar: string | null;
  credentialValue: string | undefined;
  openClawConfig: OpenClawWebSearchConfig;
  provider: WebSearchProvider;
  providerSurfaceConfig: Record<string, unknown>;
}): ResolvedRuntimeWebSearchConfig {
  if (!input.credentialEnvVar || !input.credentialValue) {
    return {
      enabled: false,
      envLines: [],
      openClawConfig: null,
      reason: `Web search is unavailable because the workspace app is missing the API key for provider "${input.provider}".`,
      surfaceConfig: parseWebSearchRuntimeConfig({
        ...input.baseSurfaceConfig,
        ...input.providerSurfaceConfig,
      }),
    };
  }

  return {
    enabled: true,
    envLines: [],
    openClawConfig: input.openClawConfig,
    reason: null,
    surfaceConfig: parseWebSearchRuntimeConfig({
      ...input.baseSurfaceConfig,
      ...input.providerSurfaceConfig,
      credentialEnvVar: input.credentialEnvVar,
    }),
  };
}

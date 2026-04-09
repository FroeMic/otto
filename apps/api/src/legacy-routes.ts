export type LegacyRouteMethod = "GET" | "PATCH" | "POST"

export type LegacyRouteDefinition = {
  exportName: LegacyRouteMethod
  honoPath: string
  legacyModulePath: string
  requestMode?: "next-request" | "request"
}

const authBasePath = "../../../web/src/app/auth"
const internalRuntimeBasePath = "../../../web/src/app/api/internal/runtime"
const oauthBasePath = "../../../web/src/app/oauth"
const webhookBasePath = "../../../web/src/app/webhooks"

export const legacyRouteDefinitions: LegacyRouteDefinition[] = [
  {
    exportName: "GET",
    honoPath: "/auth/callback",
    legacyModulePath: `${authBasePath}/callback/route`,
    requestMode: "next-request",
  },
  {
    exportName: "GET",
    honoPath: "/auth/sign-in",
    legacyModulePath: `${authBasePath}/sign-in/route`,
    requestMode: "next-request",
  },
  {
    exportName: "GET",
    honoPath: "/auth/sign-out",
    legacyModulePath: `${authBasePath}/sign-out/route`,
  },
  {
    exportName: "GET",
    honoPath: "/auth/sign-up",
    legacyModulePath: `${authBasePath}/sign-up/route`,
    requestMode: "next-request",
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/ai/openai/v1/audio/transcriptions",
    legacyModulePath: `${internalRuntimeBasePath}/ai/openai/v1/audio/transcriptions/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/ai/openai/v1/responses",
    legacyModulePath: `${internalRuntimeBasePath}/ai/openai/v1/responses/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/integrations/:integrationKey/connection",
    legacyModulePath: `${internalRuntimeBasePath}/integrations/[integrationKey]/connection/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/integrations/:integrationKey/details",
    legacyModulePath: `${internalRuntimeBasePath}/integrations/[integrationKey]/details/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/internal/runtime/integrations/:integrationKey",
    legacyModulePath: `${internalRuntimeBasePath}/integrations/[integrationKey]/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/internal/runtime/integrations/catalog",
    legacyModulePath: `${internalRuntimeBasePath}/integrations/catalog/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/integrations/execute",
    legacyModulePath: `${internalRuntimeBasePath}/integrations/execute/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/integrations/find",
    legacyModulePath: `${internalRuntimeBasePath}/integrations/find/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/internal/runtime/integrations",
    legacyModulePath: `${internalRuntimeBasePath}/integrations/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/internal/runtime/managed-config",
    legacyModulePath: `${internalRuntimeBasePath}/managed-config/route`,
  },
  {
    exportName: "PATCH",
    honoPath: "/api/internal/runtime/managed-config",
    legacyModulePath: `${internalRuntimeBasePath}/managed-config/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/internal/runtime/managed-skills",
    legacyModulePath: `${internalRuntimeBasePath}/managed-skills/route`,
  },
  {
    exportName: "PATCH",
    honoPath: "/api/internal/runtime/managed-skills",
    legacyModulePath: `${internalRuntimeBasePath}/managed-skills/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/scheduled-tasks/sync",
    legacyModulePath: `${internalRuntimeBasePath}/scheduled-tasks/sync/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/sessions/sync",
    legacyModulePath: `${internalRuntimeBasePath}/sessions/sync/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/slack/policy/apply",
    legacyModulePath: `${internalRuntimeBasePath}/slack/policy/apply/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/slack/policy/validate",
    legacyModulePath: `${internalRuntimeBasePath}/slack/policy/validate/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/surfaces/:surfaceKind/:surfaceKey/apply",
    legacyModulePath: `${internalRuntimeBasePath}/surfaces/[surfaceKind]/[surfaceKey]/apply/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/surfaces/:surfaceKind/:surfaceKey/reapply",
    legacyModulePath: `${internalRuntimeBasePath}/surfaces/[surfaceKind]/[surfaceKey]/reapply/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/internal/runtime/surfaces/:surfaceKind/:surfaceKey",
    legacyModulePath: `${internalRuntimeBasePath}/surfaces/[surfaceKind]/[surfaceKey]/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/internal/runtime/surfaces/:surfaceKind/:surfaceKey/state",
    legacyModulePath: `${internalRuntimeBasePath}/surfaces/[surfaceKind]/[surfaceKey]/state/route`,
  },
  {
    exportName: "POST",
    honoPath:
      "/api/internal/runtime/surfaces/:surfaceKind/:surfaceKey/validate",
    legacyModulePath: `${internalRuntimeBasePath}/surfaces/[surfaceKind]/[surfaceKey]/validate/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/internal/runtime/surfaces",
    legacyModulePath: `${internalRuntimeBasePath}/surfaces/route`,
  },
  {
    exportName: "POST",
    honoPath: "/webhooks/stripe",
    legacyModulePath: `${webhookBasePath}/stripe/route`,
  },
  {
    exportName: "POST",
    honoPath: "/webhooks/workos",
    legacyModulePath: `${webhookBasePath}/workos/route`,
  },
  {
    exportName: "GET",
    honoPath: "/oauth/callback/integration/:provider",
    legacyModulePath: `${oauthBasePath}/callback/integration/[provider]/route`,
  },
  {
    exportName: "GET",
    honoPath: "/oauth/callback/slack",
    legacyModulePath: `${oauthBasePath}/callback/slack/route`,
  },
  {
    exportName: "GET",
    honoPath: "/oauth/start/integration/:provider",
    legacyModulePath: `${oauthBasePath}/start/integration/[provider]/route`,
  },
  {
    exportName: "GET",
    honoPath: "/oauth/start/slack",
    legacyModulePath: `${oauthBasePath}/start/slack/route`,
  },
]

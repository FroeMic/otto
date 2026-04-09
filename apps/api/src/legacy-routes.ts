export type LegacyRouteMethod = "GET" | "PATCH" | "POST"

export type LegacyRouteDefinition = {
  exportName: LegacyRouteMethod
  honoPath: string
  legacyModulePath: string
  requestMode?: "next-request" | "request"
}

const authBasePath = "../../../web/src/app/auth"
const apiBasePath = "../../../web/src/app/api"
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
    honoPath: "/api/integrations/:orgSlug/:providerKey/disconnect",
    legacyModulePath: `${apiBasePath}/integrations/[orgSlug]/[providerKey]/disconnect/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/integrations/:orgSlug/whatsapp/disable",
    legacyModulePath: `${apiBasePath}/integrations/[orgSlug]/whatsapp/disable/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/integrations/:orgSlug/whatsapp/disconnect",
    legacyModulePath: `${apiBasePath}/integrations/[orgSlug]/whatsapp/disconnect/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/integrations/:orgSlug/whatsapp/enable",
    legacyModulePath: `${apiBasePath}/integrations/[orgSlug]/whatsapp/enable/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/integrations/:orgSlug/whatsapp/link-sessions/clear",
    legacyModulePath: `${apiBasePath}/integrations/[orgSlug]/whatsapp/link-sessions/clear/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/integrations/:orgSlug/whatsapp/link-sessions/current",
    legacyModulePath: `${apiBasePath}/integrations/[orgSlug]/whatsapp/link-sessions/current/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/integrations/:orgSlug/whatsapp/link-sessions",
    legacyModulePath: `${apiBasePath}/integrations/[orgSlug]/whatsapp/link-sessions/route`,
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
    honoPath: "/api/platform/organizations/:orgSlug/apply",
    legacyModulePath: `${apiBasePath}/platform/organizations/[orgSlug]/apply/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/platform/organizations/:orgSlug/deploy-runtime",
    legacyModulePath: `${apiBasePath}/platform/organizations/[orgSlug]/deploy-runtime/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/platform/organizations/:orgSlug/grant-credits",
    legacyModulePath: `${apiBasePath}/platform/organizations/[orgSlug]/grant-credits/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/platform/organizations/:orgSlug/jobs/:jobId/status",
    legacyModulePath: `${apiBasePath}/platform/organizations/[orgSlug]/jobs/[jobId]/status/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/platform/organizations/:orgSlug/provision-openai-key",
    legacyModulePath: `${apiBasePath}/platform/organizations/[orgSlug]/provision-openai-key/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/platform/organizations/:orgSlug/refresh-image",
    legacyModulePath: `${apiBasePath}/platform/organizations/[orgSlug]/refresh-image/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/platform/organizations/:orgSlug/usage",
    legacyModulePath: `${apiBasePath}/platform/organizations/[orgSlug]/usage/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/runtime-config/:orgSlug/surfaces/:surfaceKind/:surfaceKey",
    legacyModulePath: `${apiBasePath}/runtime-config/[orgSlug]/surfaces/[surfaceKind]/[surfaceKey]/route`,
  },
  {
    exportName: "PATCH",
    honoPath: "/api/runtime-config/:orgSlug/surfaces/:surfaceKind/:surfaceKey",
    legacyModulePath: `${apiBasePath}/runtime-config/[orgSlug]/surfaces/[surfaceKind]/[surfaceKey]/route`,
  },
  {
    exportName: "POST",
    honoPath:
      "/api/runtime-config/:orgSlug/surfaces/:surfaceKind/:surfaceKey/reapply",
    legacyModulePath: `${apiBasePath}/runtime-config/[orgSlug]/surfaces/[surfaceKind]/[surfaceKey]/reapply/route`,
  },
  {
    exportName: "POST",
    honoPath:
      "/api/runtime-config/:orgSlug/surfaces/channel/slack/channels/:channelId/membership",
    legacyModulePath: `${apiBasePath}/runtime-config/[orgSlug]/surfaces/channel/slack/channels/[channelId]/membership/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/runtime-config/:orgSlug/surfaces",
    legacyModulePath: `${apiBasePath}/runtime-config/[orgSlug]/surfaces/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/user/profile",
    legacyModulePath: `${apiBasePath}/user/profile/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/workspace/:orgSlug/billing/checkout",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/billing/checkout/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/workspace/:orgSlug/billing/portal",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/billing/portal/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/workspace/:orgSlug/billing/preferences",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/billing/preferences/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/workspace/:orgSlug/jobs/:jobId/status",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/jobs/[jobId]/status/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/workspace/:orgSlug/members/:membershipId/reactivate",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/members/[membershipId]/reactivate/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/workspace/:orgSlug/members/:membershipId/role",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/members/[membershipId]/role/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/workspace/:orgSlug/members/:membershipId/suspend",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/members/[membershipId]/suspend/route`,
  },
  {
    exportName: "POST",
    honoPath:
      "/api/workspace/:orgSlug/members/invitations/:invitationId/resend",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/members/invitations/[invitationId]/resend/route`,
  },
  {
    exportName: "POST",
    honoPath:
      "/api/workspace/:orgSlug/members/invitations/:invitationId/revoke",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/members/invitations/[invitationId]/revoke/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/workspace/:orgSlug/members/invitations",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/members/invitations/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/workspace/:orgSlug/scheduled-tasks/refresh",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/scheduled-tasks/refresh/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/workspace/:orgSlug/sessions/refresh",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/sessions/refresh/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/workspace/:orgSlug/settings",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/settings/route`,
  },
  {
    exportName: "POST",
    honoPath: "/api/workspace/:orgSlug/slack/resync-directory",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/slack/resync-directory/route`,
  },
  {
    exportName: "GET",
    honoPath: "/api/workspace/:orgSlug/usage",
    legacyModulePath: `${apiBasePath}/workspace/[orgSlug]/usage/route`,
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

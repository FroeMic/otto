import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import {
  workspaceJobStatusResponseSchema,
  workspaceIntegrationCapabilityPolicyResponseSchema,
  workspaceIntegrationCapabilityPolicyUpdateSchema,
  workspaceIntegrationDetailSchema,
  workspaceIntegrationDisconnectResponseSchema,
  workspaceIntegrationsResponseSchema,
  workspaceSlackDirectoryResyncResponseSchema,
  workspaceSlackDirectoryResyncSchema,
  workspaceSlackChannelMembershipResponseSchema,
  workspaceSlackChannelMembershipUpdateSchema,
  workspaceSlackSettingsPatchSchema,
  workspaceSlackSettingsUpdateResponseSchema,
} from "@otto/feature-integrations-runtime/workspace"
import { Hono } from "hono"
import { z } from "zod"

import {
  disconnectWorkspaceIntegration,
  enqueueWorkspaceSlackDirectoryResync,
  updateWorkspaceIntegrationCapabilityPolicy,
  updateWorkspaceSlackChannelMembership,
  updateWorkspaceSlackSettings,
} from "./actions"
import {
  getWorkspaceJobStatus,
  getWorkspaceIntegrationDetail,
  listWorkspaceIntegrations,
} from "./data"

const workspaceIntegrationsParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const workspaceIntegrationDetailParamsSchema = workspaceIntegrationsParamsSchema.extend({
  integrationKey: z.string().min(1),
})

const workspaceIntegrationCapabilityPolicyParamsSchema =
  workspaceIntegrationDetailParamsSchema.extend({
    capabilityKey: z.string().min(1),
  })

const workspaceSlackChannelMembershipParamsSchema =
  workspaceIntegrationsParamsSchema.extend({
    channelId: z.string().min(1),
  })

const workspaceJobParamsSchema = workspaceIntegrationsParamsSchema.extend({
  jobId: z.string().min(1),
})

export interface WorkspaceIntegrationUser {
  email: string
  firstName?: string | null
  id: string
  lastName?: string | null
}

export interface IntegrationsRouteDependencies {
  authenticateWorkspaceUser: (
    request: Request,
  ) => Promise<WorkspaceIntegrationUser>
  getWorkspaceIntegrationDetail: typeof getWorkspaceIntegrationDetail
  listWorkspaceIntegrations: typeof listWorkspaceIntegrations
  disconnectWorkspaceIntegration: typeof disconnectWorkspaceIntegration
  enqueueWorkspaceSlackDirectoryResync: typeof enqueueWorkspaceSlackDirectoryResync
  getWorkspaceJobStatus: typeof getWorkspaceJobStatus
  updateWorkspaceIntegrationCapabilityPolicy: typeof updateWorkspaceIntegrationCapabilityPolicy
  updateWorkspaceSlackChannelMembership: typeof updateWorkspaceSlackChannelMembership
  updateWorkspaceSlackSettings: typeof updateWorkspaceSlackSettings
}

function createDefaultIntegrationsRouteDependencies(): IntegrationsRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    disconnectWorkspaceIntegration,
    enqueueWorkspaceSlackDirectoryResync,
    getWorkspaceJobStatus,
    getWorkspaceIntegrationDetail,
    listWorkspaceIntegrations,
    updateWorkspaceIntegrationCapabilityPolicy,
    updateWorkspaceSlackChannelMembership,
    updateWorkspaceSlackSettings,
  }
}

export function createIntegrationsRouter(
  dependencies: IntegrationsRouteDependencies = createDefaultIntegrationsRouteDependencies(),
) {
  const app = new Hono()

  async function authenticateUser(request: Request) {
    try {
      return {
        user: await dependencies.authenticateWorkspaceUser(request),
      } as const
    } catch (error) {
      if (isWorkspaceSessionAuthError(error)) {
        return {
          response: jsonNoStore(
            {
              code: error.code,
              message: error.message,
            },
            error.status,
          ),
        } as const
      }

      throw error
    }
  }

  return app
    .get(
      "/api/workspace/:orgSlug/integrations",
      zValidator("param", workspaceIntegrationsParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const integrations = await dependencies.listWorkspaceIntegrations({
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(
          workspaceIntegrationsResponseSchema.parse({
            integrations,
          }),
        )
      },
    )
    .get(
      "/api/workspace/:orgSlug/integrations/:integrationKey",
      zValidator("param", workspaceIntegrationDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const detail = await dependencies.getWorkspaceIntegrationDetail({
          integrationKey: context.req.valid("param").integrationKey,
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        if (!detail) {
          return jsonNoStore(
            {
              code: "integration_not_found",
              message: "Integration not found",
            },
            404,
          )
        }

        return jsonNoStore(workspaceIntegrationDetailSchema.parse(detail))
      },
    )
    .post(
      "/api/workspace/:orgSlug/integrations/:integrationKey/disconnect",
      zValidator("param", workspaceIntegrationDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const result = await dependencies.disconnectWorkspaceIntegration({
          orgSlug: context.req.valid("param").orgSlug,
          providerKey: context.req.valid("param").integrationKey,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(
          workspaceIntegrationDisconnectResponseSchema.parse(result),
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/integrations/slack/resync-directory",
      zValidator("json", workspaceSlackDirectoryResyncSchema),
      zValidator("param", workspaceIntegrationsParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const result = await dependencies.enqueueWorkspaceSlackDirectoryResync({
          action: context.req.valid("json").action,
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(
          workspaceSlackDirectoryResyncResponseSchema.parse(result),
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/integrations/:integrationKey/capabilities/:capabilityKey/policy",
      zValidator("json", workspaceIntegrationCapabilityPolicyUpdateSchema),
      zValidator("param", workspaceIntegrationCapabilityPolicyParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const row = await dependencies.updateWorkspaceIntegrationCapabilityPolicy({
          capabilityKey: decodeURIComponent(context.req.valid("param").capabilityKey),
          orgSlug: context.req.valid("param").orgSlug,
          policy: context.req.valid("json"),
          providerKey: context.req.valid("param").integrationKey,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(
          workspaceIntegrationCapabilityPolicyResponseSchema.parse({
            row,
          }),
        )
      },
    )
    .patch(
      "/api/workspace/:orgSlug/integrations/:integrationKey/settings",
      zValidator("json", workspaceSlackSettingsPatchSchema),
      zValidator("param", workspaceIntegrationDetailParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const result = await dependencies.updateWorkspaceSlackSettings({
          ...context.req.valid("json"),
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(
          workspaceSlackSettingsUpdateResponseSchema.parse(result),
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/integrations/slack/channels/:channelId/membership",
      zValidator("json", workspaceSlackChannelMembershipUpdateSchema),
      zValidator("param", workspaceSlackChannelMembershipParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const result = await dependencies.updateWorkspaceSlackChannelMembership({
          action: context.req.valid("json").action,
          channelId: context.req.valid("param").channelId,
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        return jsonNoStore(
          workspaceSlackChannelMembershipResponseSchema.parse(result),
        )
      },
    )
    .get(
      "/api/workspace/:orgSlug/jobs/:jobId/status",
      zValidator("param", workspaceJobParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const status = await dependencies.getWorkspaceJobStatus({
          jobId: context.req.valid("param").jobId,
          orgSlug: context.req.valid("param").orgSlug,
          userExternalId: authResult.user.id,
        })

        if (!status) {
          return jsonNoStore(
            {
              code: "job_not_found",
              message: "Workspace job status not found",
            },
            404,
          )
        }

        return jsonNoStore(workspaceJobStatusResponseSchema.parse(status))
      },
    )
}

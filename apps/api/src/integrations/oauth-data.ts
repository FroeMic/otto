import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  getTenantManagedIntegrationConnectContext,
  persistManagedLinearOauthConnection,
  persistManagedSlackOauthConnection,
  recordLinearOauthFailure,
  recordSlackManagedOauthFailure,
} from "@otto/feature-integrations-runtime/db/managed-integrations"
import {
  recordMessagingWorkspaceSyncFailure,
  syncMessagingDirectoryForTenantIntegration,
} from "@otto/feature-integrations-runtime/db/messaging-directory"
import { getLocalUserIdForExternalId } from "@otto/feature-integrations-runtime/db/oauth"
import {
  tenantApplyRuns,
  tenantDesiredStates,
  tenantIntegrations,
} from "@otto/feature-integrations-runtime/db/schema"
import { getIntegrationDefinition } from "@otto/feature-integrations-runtime/integrations/framework"
import { fetchSlackMessagingDirectory } from "@otto/feature-integrations-runtime/lib/slack"
import {
  createManagedIntegrationOauthAuthorizationUrl,
  getManagedIntegrationOauthCallbackContext,
} from "@otto/feature-integrations-runtime/oauth/service"
import { and, desc, eq } from "drizzle-orm"

import { enqueueJob } from "../jobs/queue"
import { JOB_TYPES } from "../jobs/types"
import { createDesiredStateVersionForConnectedSlackIntegration } from "../runtime/slack-settings"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function buildAbsoluteUrl(pathname: string, baseUrl: string) {
  return new URL(pathname, baseUrl).toString()
}

function getWorkspaceIntegrationPath(input: {
  orgSlug: string
  providerKey: string
}) {
  const definition = getIntegrationDefinition(input.providerKey)

  return definition
    ? definition.settingsPath(input.orgSlug)
    : `/${input.orgSlug}/settings/agent/integrations/${input.providerKey}/status`
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "The integration could not be connected."
}

function buildSuccessRedirect(input: {
  orgSlug: string
  providerKey: string
  publicBaseUrl: string
}) {
  return buildAbsoluteUrl(
    `${getWorkspaceIntegrationPath({
      orgSlug: input.orgSlug,
      providerKey: input.providerKey,
    })}?${input.providerKey}_connected=1`,
    input.publicBaseUrl,
  )
}

function buildFailureRedirect(input: {
  message: string
  orgSlug: string | null
  providerKey: string
  publicBaseUrl: string
}) {
  const path = input.orgSlug
    ? getWorkspaceIntegrationPath({
        orgSlug: input.orgSlug,
        providerKey: input.providerKey,
      })
    : "/login"

  return buildAbsoluteUrl(
    `${path}?${input.providerKey}_error=${encodeURIComponent(input.message)}`,
    input.publicBaseUrl,
  )
}

export async function beginWorkspaceIntegrationOauth(input: {
  orgSlug: string | null
  providerKey: string
  publicBaseUrl: string
  userExternalId: string
}) {
  const providerKey = input.providerKey.trim().toLowerCase()
  const fallbackOrgSlug = input.orgSlug?.trim() || null

  try {
    if (!fallbackOrgSlug) {
      throw new Error("Missing workspace slug.")
    }

    const connectContext = await getTenantManagedIntegrationConnectContext({
      orgSlug: fallbackOrgSlug,
      providerKey,
      userExternalId: input.userExternalId,
    })

    if (!connectContext) {
      throw new Error("This workspace is not available.")
    }

    const authorization = await createManagedIntegrationOauthAuthorizationUrl({
      mode:
        connectContext.integrationStatus === "connected"
          ? "reconnect"
          : "connect",
      organizationId: connectContext.organizationId,
      providerKey,
      tenantId: connectContext.tenantId,
      tenantIntegrationId: connectContext.tenantIntegrationId,
      userId: connectContext.userId,
    })

    return {
      authorizeUrl: authorization.authorizeUrl,
    }
  } catch (error) {
    return {
      authorizeUrl: buildFailureRedirect({
        message:
          error instanceof Error
            ? error.message
            : "The integration could not be opened right now.",
        orgSlug: fallbackOrgSlug,
        providerKey,
        publicBaseUrl: input.publicBaseUrl,
      }),
    }
  }
}

export async function completeWorkspaceIntegrationOauth(input: {
  code: string | null
  encodedState: string | null
  providerError: string | null
  providerKey: string
  publicBaseUrl: string
  userExternalId: string
}) {
  const providerKey = input.providerKey.trim().toLowerCase()
  const localUserId = await getLocalUserIdForExternalId(input.userExternalId)
  let callbackContext: Awaited<
    ReturnType<typeof getManagedIntegrationOauthCallbackContext>
  > | null = null

  try {
    if (!localUserId) {
      throw new Error("Signed-in user could not be matched locally.")
    }

    if (!input.code || !input.encodedState) {
      throw new Error("Missing OAuth code or state.")
    }

    callbackContext = await getManagedIntegrationOauthCallbackContext({
      encodedState: input.encodedState,
      expectedProviderKey: providerKey,
      userId: localUserId,
    })

    if (input.providerError) {
      throw new Error(input.providerError)
    }

    if (callbackContext.session.consumedAt) {
      return {
        redirectUrl: buildSuccessRedirect({
          orgSlug: callbackContext.session.organizationSlug,
          providerKey: callbackContext.session.providerKey,
          publicBaseUrl: input.publicBaseUrl,
        }),
      }
    }

    const tokenResult = await callbackContext.provider.exchangeCode({
      code: input.code,
      codeVerifier: callbackContext.session.pkceCodeVerifier,
    })

    switch (callbackContext.session.providerKey) {
      case "linear": {
        const result = await persistManagedLinearOauthConnection({
          actorType: tokenResult.actorType,
          externalAccountId: tokenResult.identity?.externalAccountId ?? null,
          externalAccountLabel:
            tokenResult.identity?.externalAccountLabel ?? null,
          mode:
            callbackContext.session.mode === "reconnect"
              ? "reconnect"
              : "connect",
          organizationId: callbackContext.session.organizationId,
          requestedScopes: callbackContext.session.requestedScopes,
          sessionId: callbackContext.session.id,
          tokenResult,
        })

        const desiredStateVersion =
          await createDesiredStateVersionForConnectedIntegration({
            providerKey: "linear",
            tenantId: result.tenantId,
          })

        if (result.shouldEnqueueApply) {
          await enqueueTenantConfigApply({
            desiredStateVersion,
            tenantId: result.tenantId,
          })
        }

        return {
          redirectUrl: buildSuccessRedirect({
            orgSlug: result.organizationSlug,
            providerKey: "linear",
            publicBaseUrl: input.publicBaseUrl,
          }),
        }
      }
      case "slack": {
        const result = await persistManagedSlackOauthConnection({
          mode:
            callbackContext.session.mode === "reconnect"
              ? "reconnect"
              : "connect",
          organizationId: callbackContext.session.organizationId,
          requestedScopes: callbackContext.session.requestedScopes,
          sessionId: callbackContext.session.id,
          tokenResult,
        })

        try {
          const directory = await fetchSlackMessagingDirectory(
            tokenResult.accessToken,
          )

          await syncMessagingDirectoryForTenantIntegration({
            conversations: directory.conversations,
            externalWorkspaceId: result.slackTeamId,
            members: directory.members,
            tenantIntegrationId: result.tenantIntegrationId,
            workspaceDisplayName: result.slackTeamName,
          })
        } catch (directoryError) {
          await recordMessagingWorkspaceSyncFailure({
            error: getErrorMessage(directoryError),
            externalWorkspaceId: result.slackTeamId,
            tenantIntegrationId: result.tenantIntegrationId,
            workspaceDisplayName: result.slackTeamName,
          })
        }

        const desiredStateVersion =
          await createDesiredStateVersionForConnectedSlackIntegration(
            result.tenantId,
          )

        if (result.shouldEnqueueApply) {
          await markSlackIntegrationPendingApply(result.tenantId)
          await enqueueTenantConfigApply({
            desiredStateVersion: desiredStateVersion.version,
            tenantId: result.tenantId,
          })
        }

        return {
          redirectUrl: buildSuccessRedirect({
            orgSlug: result.organizationSlug,
            providerKey: "slack",
            publicBaseUrl: input.publicBaseUrl,
          }),
        }
      }
      default:
        throw new Error(
          `Unsupported managed integration callback: ${callbackContext.session.providerKey}`,
        )
    }
  } catch (error) {
    if (callbackContext?.session.providerKey === "linear") {
      await recordLinearOauthFailure({
        error: getErrorMessage(error),
        organizationId: callbackContext.session.organizationId,
      })
    } else if (callbackContext?.session.providerKey === "slack") {
      await recordSlackManagedOauthFailure({
        error: getErrorMessage(error),
        organizationId: callbackContext.session.organizationId,
      })
    }

    return {
      redirectUrl: buildFailureRedirect({
        message: getErrorMessage(error),
        orgSlug: callbackContext?.session.organizationSlug ?? null,
        providerKey,
        publicBaseUrl: input.publicBaseUrl,
      }),
    }
  }
}

async function createDesiredStateVersionForConnectedIntegration(input: {
  providerKey: string
  tenantId: string
}) {
  const db = getDb()
  const latestDesiredState = await db
    .select({
      configJson: tenantDesiredStates.configJson,
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(eq(tenantDesiredStates.tenantId, input.tenantId))
    .orderBy(desc(tenantDesiredStates.version))
    .limit(1)
    .then((rows) => rows[0] ?? null)
  const currentConfig = isRecord(latestDesiredState?.configJson)
    ? { ...latestDesiredState.configJson }
    : {}
  const integrations = Array.isArray(currentConfig.integrations)
    ? currentConfig.integrations.filter(
        (entry: unknown): entry is string =>
          typeof entry === "string" && entry !== input.providerKey,
      )
    : []

  integrations.push(input.providerKey)
  const nextVersion = (latestDesiredState?.version ?? 0) + 1

  const [createdDesiredState] = await db
    .insert(tenantDesiredStates)
    .values({
      configJson: {
        ...currentConfig,
        integrations: [...new Set(integrations)],
      },
      tenantId: input.tenantId,
      version: nextVersion,
    })
    .returning({
      version: tenantDesiredStates.version,
    })

  return createdDesiredState.version
}

async function enqueueTenantConfigApply(input: {
  desiredStateVersion: number
  tenantId: string
}) {
  const jobId = await enqueueJob({
    jobType: JOB_TYPES.applyTenantConfig,
    payload: {
      desiredStateVersion: input.desiredStateVersion,
      tenantId: input.tenantId,
    },
  })
  const db = getDb()

  await db.insert(tenantApplyRuns).values({
    desiredStateVersion: input.desiredStateVersion,
    jobRunId: jobId,
    status: "queued",
    tenantId: input.tenantId,
  })
}

async function markSlackIntegrationPendingApply(tenantId: string) {
  const db = getDb()

  await db
    .update(tenantIntegrations)
    .set({
      lastError: null,
      lastErrorAt: null,
      status: "pending_apply",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, "slack"),
      ),
    )
}

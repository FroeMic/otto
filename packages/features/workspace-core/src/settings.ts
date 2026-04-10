import { jsonNoStore } from "@otto/auth"
import { isReservedWorkspaceSlug } from "@otto/feature-workspace-slugs"
import * as z from "zod"

import type { WorkspaceShellUser } from "./bootstrap"
import {
  workspaceSettingsSuccessSchema,
  workspaceSettingsUpdateSchema,
} from "./schemas"

export async function handleWorkspaceSettingsUpdateRequest<
  TUser extends WorkspaceShellUser,
>(input: {
  getOrganizationWorkspaceBySlug: (payload: {
    orgSlug: string
    userExternalId: string
  }) => Promise<{ externalId: string; id: string }>
  orgSlug: string
  renameOrganization: (payload: {
    externalOrganizationId: string
    name: string
    organizationId: string
  }) => Promise<void>
  request: Request
  syncUserFromSession: (user: TUser) => Promise<unknown>
  updateOrganizationSlug: (payload: {
    organizationId: string
    slug: string
  }) => Promise<"ok" | "slug_taken">
  updateWorkspaceDateTimePreferences: (payload: {
    organizationId: string
    locale?: string
    timeFormatPreference?: string
    timezone?: string
  }) => Promise<{
    applyQueued: boolean
    locale: string
    timeFormatPreference: string
    timezone: string
  }>
  user: TUser
}) {
  try {
    await input.syncUserFromSession(input.user)
    const body = workspaceSettingsUpdateSchema.parse(await input.request.json())
    const organization = await input.getOrganizationWorkspaceBySlug({
      orgSlug: input.orgSlug,
      userExternalId: input.user.id,
    })

    if (body.action === "update-name") {
      await input.renameOrganization({
        externalOrganizationId: organization.externalId,
        name: body.name,
        organizationId: organization.id,
      })

      return jsonNoStore(
        workspaceSettingsSuccessSchema.parse({ name: body.name }),
      )
    }

    if (body.action === "update-slug") {
      if (isReservedWorkspaceSlug(body.slug)) {
        return jsonNoStore(
          { code: "slug_reserved", message: "This URL is reserved" },
          409,
        )
      }

      const result = await input.updateOrganizationSlug({
        organizationId: organization.id,
        slug: body.slug,
      })

      if (result === "slug_taken") {
        return jsonNoStore(
          { code: "slug_taken", message: "This URL is already in use" },
          409,
        )
      }

      return jsonNoStore(
        workspaceSettingsSuccessSchema.parse({ slug: body.slug }),
      )
    }

    const result = await input.updateWorkspaceDateTimePreferences(
      body.action === "update-timezone"
        ? {
            organizationId: organization.id,
            timezone: body.timezone,
          }
        : body.action === "update-locale"
          ? {
              locale: body.locale,
              organizationId: organization.id,
            }
          : {
              organizationId: organization.id,
              timeFormatPreference: body.timeFormatPreference,
            },
    )

    return jsonNoStore(workspaceSettingsSuccessSchema.parse(result))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonNoStore(
        {
          code: "schema_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid payload",
        },
        400,
      )
    }

    return jsonNoStore(
      {
        code: "update_failed",
        message: error instanceof Error ? error.message : "Update failed",
      },
      400,
    )
  }
}

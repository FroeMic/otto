import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  organizations,
  userChannelIdentities,
  users,
} from "@otto/feature-integrations-runtime/db/schema"
import { WorkOS } from "@workos-inc/node"
import { and, asc, eq } from "drizzle-orm"

import { getApiEnv } from "../env"
import { getOrganizationWorkspaceBySlug } from "../workspace/data"

function getWorkOs() {
  const env = getApiEnv()

  return new WorkOS(env.WORKOS_API_KEY ?? "", {
    clientId: env.WORKOS_CLIENT_ID,
  })
}

export async function getUserProfile(userExternalId: string) {
  const user = await getWorkOs().userManagement.getUser(userExternalId)

  return {
    email: user.email,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
  }
}

export async function updateUserProfile(input: {
  firstName: string
  lastName: string
  userExternalId: string
}) {
  const user = await getWorkOs().userManagement.updateUser({
    firstName: input.firstName,
    lastName: input.lastName,
    userId: input.userExternalId,
  })

  return {
    email: user.email,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
  }
}

export async function getConnectedAccounts(input: {
  orgSlug: string
  userExternalId: string
}) {
  const workspace = await getOrganizationWorkspaceBySlug({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })
  const db = getDb()

  return db
    .select({
      avatarUrl: userChannelIdentities.avatarUrl,
      displayName: userChannelIdentities.displayName,
      externalId: userChannelIdentities.externalId,
      fullName: userChannelIdentities.fullName,
      id: userChannelIdentities.id,
      provider: userChannelIdentities.provider,
      username: userChannelIdentities.username,
    })
    .from(userChannelIdentities)
    .innerJoin(users, eq(userChannelIdentities.userId, users.id))
    .innerJoin(
      organizations,
      eq(userChannelIdentities.organizationId, organizations.id),
    )
    .where(
      and(
        eq(users.externalId, input.userExternalId),
        eq(organizations.id, workspace.id),
      ),
    )
    .orderBy(asc(userChannelIdentities.provider))
}

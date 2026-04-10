import { useSuspenseQuery } from "@tanstack/react-query"

import { SettingsPage, SettingsPageTitle } from "@/client/app/app-shell/SettingsLayout"

import { workspaceMembersQueryOptions } from "../api/members"
import { shellBootstrapQueryOptions } from "../api/workspace"
import { WorkspaceMembersTable } from "../components/WorkspaceMembersTable"

export interface WorkspaceMembersPageProps {
  orgSlug: string
}

export function WorkspaceMembersPage({
  orgSlug,
}: WorkspaceMembersPageProps) {
  const { data: shellData } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))
  const { data: memberDirectory } = useSuspenseQuery(
    workspaceMembersQueryOptions(orgSlug),
  )

  return (
    <SettingsPage>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <SettingsPageTitle>Members</SettingsPageTitle>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {memberDirectory.activeMemberCount} active member
            {memberDirectory.activeMemberCount === 1 ? "" : "s"} and{" "}
            {memberDirectory.invitationCount} invitation
            {memberDirectory.invitationCount === 1 ? "" : "s"} in{" "}
            {memberDirectory.organizationName}.
          </p>
        </div>

        <WorkspaceMembersTable
          availableRoles={memberDirectory.availableRoles}
          canManageMembers={memberDirectory.canManageMembers}
          dateTimePreferences={{
            locale: shellData.currentOrganization.locale,
            timeFormatPreference:
              shellData.currentOrganization.timeFormatPreference,
            timeZone: shellData.currentOrganization.timezone,
          }}
          entries={memberDirectory.entries}
          orgSlug={memberDirectory.organizationSlug}
        />
      </div>
    </SettingsPage>
  )
}

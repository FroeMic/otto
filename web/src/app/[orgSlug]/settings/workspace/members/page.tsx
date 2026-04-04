import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { SettingsPageTitle } from "@/app/[orgSlug]/settings/_components/settings-layout";
import { WorkspaceMembersTable } from "@/app/[orgSlug]/settings/workspace/members/_components/workspace-members-table";
import { listWorkspaceMembers } from "@/db/control-plane";
import { resolveDateTimePreferences } from "@/lib/date-time";

export const dynamic = "force-dynamic";

export default async function WorkspaceMembersSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization, user } =
    await loadOrganizationRouteContext(orgSlug);
  const memberDirectory = await listWorkspaceMembers({
    orgSlug,
    userExternalId: user.id,
  });
  const dateTimePreferences = resolveDateTimePreferences({
    locale: currentOrganization.locale,
    timeFormatPreference: currentOrganization.timeFormatPreference,
    timeZone: currentOrganization.timezone,
  });

  return (
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
        dateTimePreferences={dateTimePreferences}
        entries={memberDirectory.entries}
        orgSlug={memberDirectory.organizationSlug}
      />
    </div>
  );
}

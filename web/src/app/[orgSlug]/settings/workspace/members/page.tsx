import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { WorkspaceMembersTable } from "@/app/[orgSlug]/settings/workspace/members/_components/workspace-members-table";
import { listWorkspaceMembers } from "@/db/control-plane";

export const dynamic = "force-dynamic";

export default async function WorkspaceMembersSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { user } = await loadOrganizationRouteContext(orgSlug);
  const memberDirectory = await listWorkspaceMembers({
    orgSlug,
    userExternalId: user.id,
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Members</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Review who can access this workspace and keep WorkOS invitations in
          one place. {memberDirectory.activeMemberCount} active member
          {memberDirectory.activeMemberCount === 1 ? "" : "s"} and{" "}
          {memberDirectory.invitationCount} invitation
          {memberDirectory.invitationCount === 1 ? "" : "s"} are currently
          listed for {memberDirectory.organizationName}.
        </p>
      </section>

      <WorkspaceMembersTable
        availableRoles={memberDirectory.availableRoles}
        canManageMembers={memberDirectory.canManageMembers}
        entries={memberDirectory.entries}
        orgSlug={memberDirectory.organizationSlug}
      />
    </div>
  );
}

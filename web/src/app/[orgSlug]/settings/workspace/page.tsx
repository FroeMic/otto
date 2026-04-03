import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  SettingsPage,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { WorkspaceDetailsCard } from "@/app/[orgSlug]/settings/workspace/_components/workspace-settings-form";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  return (
    <SettingsPage>
      <div className="flex flex-col gap-8">
        <SettingsPageTitle>General</SettingsPageTitle>

        <SettingsSection>
          <SettingsSectionTitle>Workspace details</SettingsSectionTitle>
          <WorkspaceDetailsCard
            orgSlug={orgSlug}
            organization={{
              name: organization.name,
              slug: organization.slug,
            }}
          />
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}

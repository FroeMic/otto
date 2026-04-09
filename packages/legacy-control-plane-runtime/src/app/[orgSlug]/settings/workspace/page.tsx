import { loadOrganizationRouteContext } from "../../_lib/organization-context";
import {
  SettingsPage,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "../_components/settings-layout";
import {
  WorkspaceDetailsCard,
  WorkspaceTimeAndRegionCard,
} from "./_components/workspace-settings-form";
import { resolveDateTimePreferences } from "../../../../lib/date-time";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);
  const initialPreferences = resolveDateTimePreferences({
    locale: organization.locale,
    timeFormatPreference: organization.timeFormatPreference,
    timeZone: organization.timezone,
  });

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

        <SettingsSection>
          <SettingsSectionTitle>Time and Region</SettingsSectionTitle>
          <WorkspaceTimeAndRegionCard
            initialPreferences={initialPreferences}
            orgSlug={orgSlug}
          />
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}

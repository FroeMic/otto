import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  SettingsCard,
  SettingsPage,
  SettingsPageTitle,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { getRuntimeStatusLabel, getSlackStatusLabel } from "@/lib/workspace";

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
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Name</SettingsRowTitle>
              </SettingsRowLabel>
              <span className="text-sm text-muted-foreground">
                {organization.name}
              </span>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>URL</SettingsRowTitle>
              </SettingsRowLabel>
              <span className="text-sm text-muted-foreground">
                /{organization.slug}
              </span>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Your role</SettingsRowTitle>
              </SettingsRowLabel>
              <span className="text-sm capitalize text-muted-foreground">
                {organization.role}
              </span>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Integrations</SettingsSectionTitle>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Slack</SettingsRowTitle>
              </SettingsRowLabel>
              <span className="text-sm text-muted-foreground">
                {getSlackStatusLabel(organization)}
              </span>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Otto</SettingsRowTitle>
              </SettingsRowLabel>
              <span className="text-sm text-muted-foreground">
                {getRuntimeStatusLabel(organization)}
              </span>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}

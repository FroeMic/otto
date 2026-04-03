import {
  SettingsCard,
  SettingsPage,
  SettingsSection,
  SettingsSectionTitle,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { loadPlatformOrganizationDetailRouteContext } from "@/app/platform/organizations/[orgSlug]/_lib/platform-organization-detail";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default async function PlatformOrganizationLogsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization } =
    await loadPlatformOrganizationDetailRouteContext(orgSlug);

  if (!organization.tenant) {
    return (
      <div className="px-4 pb-6 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No tenant provisioned yet</EmptyTitle>
            <EmptyDescription>
              This organization does not have a tenant runtime yet, so logs are
              not available.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 md:px-6">
      <SettingsPage className="mx-0 max-w-2xl">
        <div className="flex flex-col gap-10">
          <SettingsSection>
            <SettingsSectionTitle>Logs</SettingsSectionTitle>
            <SettingsCard>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Status</SettingsRowTitle>
                </SettingsRowLabel>
                <span className="text-sm text-foreground">Coming later</span>
              </SettingsRow>
            </SettingsCard>
          </SettingsSection>
        </div>
      </SettingsPage>
    </div>
  );
}

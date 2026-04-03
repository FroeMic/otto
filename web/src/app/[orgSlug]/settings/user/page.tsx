import { withAuth } from "@workos-inc/authkit-nextjs";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  SettingsPage,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { ConnectedAccountsCard } from "@/app/[orgSlug]/settings/user/_components/connected-accounts-card";
import {
  AccountDetailsCard,
  ThemeSettingsCard,
} from "@/app/[orgSlug]/settings/user/_components/user-settings-form";
import { getUserChannelIdentities } from "@/db/control-plane";
import { getWorkOS } from "@/lib/workos";

export const dynamic = "force-dynamic";

export default async function UserSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { user: sessionUser } = await withAuth({ ensureSignedIn: true });
  const workos = getWorkOS();
  const user = await workos.userManagement.getUser(sessionUser.id);
  const { currentOrganization } = await loadOrganizationRouteContext(orgSlug);

  const identities = await getUserChannelIdentities({
    userExternalId: sessionUser.id,
    organizationId: currentOrganization.id,
  });

  return (
    <SettingsPage>
      <div className="flex flex-col gap-8">
        <SettingsPageTitle>Account</SettingsPageTitle>

        <SettingsSection>
          <SettingsSectionTitle>Account details</SettingsSectionTitle>
          <AccountDetailsCard
            user={{
              email: user.email,
              firstName: user.firstName ?? "",
              lastName: user.lastName ?? "",
            }}
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Connected accounts</SettingsSectionTitle>
          <SettingsSectionDescription>
            Your linked messaging accounts in this workspace. Used to identify
            your messages in session transcripts.
          </SettingsSectionDescription>
          <ConnectedAccountsCard identities={identities} />
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Preferences</SettingsSectionTitle>
          <ThemeSettingsCard />
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}

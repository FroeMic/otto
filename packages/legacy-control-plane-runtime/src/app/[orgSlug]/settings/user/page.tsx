import { withAuth } from "@workos-inc/authkit-nextjs";

import { loadOrganizationRouteContext } from "../../_lib/organization-context";
import {
  SettingsPage,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "../_components/settings-layout";
import { ConnectedAccountsCard } from "./_components/connected-accounts-card";
import {
  AccountDetailsCard,
  ThemeSettingsCard,
} from "./_components/user-settings-form";
import { getUserChannelIdentities } from "../../../../db/control-plane";
import { getWorkOS } from "../../../../lib/workos";
import { isSlackConnected } from "../../../../lib/workspace";

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

  // Derive connected integrations from org state — only show providers
  // that are actually connected to this workspace
  const connectedIntegrations: Array<{
    provider: string;
    label: string;
    icon: string;
  }> = [];

  if (isSlackConnected(currentOrganization)) {
    connectedIntegrations.push({
      provider: "slack",
      label: "Slack",
      icon: "/integrations/slack.svg",
    });
  }

  if (currentOrganization.whatsappIntegration?.status === "connected") {
    connectedIntegrations.push({
      provider: "whatsapp",
      label: "WhatsApp",
      icon: "/integrations/whatsapp.png",
    });
  }

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
          <ConnectedAccountsCard
            identities={identities}
            connectedIntegrations={connectedIntegrations}
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Preferences</SettingsSectionTitle>
          <ThemeSettingsCard />
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}

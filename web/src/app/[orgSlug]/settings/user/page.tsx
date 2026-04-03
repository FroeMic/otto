import { withAuth } from "@workos-inc/authkit-nextjs";

import {
  SettingsPage,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import {
  AccountDetailsCard,
  ThemeSettingsCard,
} from "@/app/[orgSlug]/settings/user/_components/user-settings-form";
import { getWorkOS } from "@/lib/workos";

export const dynamic = "force-dynamic";

export default async function UserSettingsPage() {
  const { user: sessionUser } = await withAuth({ ensureSignedIn: true });
  const workos = getWorkOS();
  const user = await workos.userManagement.getUser(sessionUser.id);

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
          <SettingsSectionTitle>Preferences</SettingsSectionTitle>
          <ThemeSettingsCard />
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}

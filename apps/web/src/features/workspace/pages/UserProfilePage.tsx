import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"

import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import {
  connectedAccountsQueryOptions,
  userProfileQueryOptions,
} from "@/features/workspace/api/workspace"

import { AccountDetailsCard } from "../components/AccountDetailsCard"
import { ConnectedAccountsCard } from "../components/ConnectedAccountsCard"
import { ThemeSettingsCard } from "../components/ThemeSettingsCard"

export interface UserProfilePageProps {
  orgSlug: string
}

export function UserProfilePage({ orgSlug }: UserProfilePageProps) {
  const queryClient = useQueryClient()
  const { data: profile } = useSuspenseQuery(userProfileQueryOptions())
  const { data: connectedAccounts } = useSuspenseQuery(
    connectedAccountsQueryOptions(orgSlug),
  )

  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <SettingsPageTitle>Account</SettingsPageTitle>

        <SettingsSection>
          <SettingsSectionTitle>Account details</SettingsSectionTitle>
          <AccountDetailsCard
            email={profile.email}
            firstName={profile.firstName}
            lastName={profile.lastName}
            onSaved={async () => {
              await queryClient.invalidateQueries({
                queryKey: ["user-profile"],
              })
            }}
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Connected accounts</SettingsSectionTitle>
          <SettingsSectionDescription>
            Your linked messaging accounts in this workspace. Used to identify
            your messages in session transcripts.
          </SettingsSectionDescription>
          <ConnectedAccountsCard connectedAccounts={connectedAccounts} />
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Preferences</SettingsSectionTitle>
          <ThemeSettingsCard />
        </SettingsSection>
      </SettingsPageContent>
    </SettingsPage>
  )
}

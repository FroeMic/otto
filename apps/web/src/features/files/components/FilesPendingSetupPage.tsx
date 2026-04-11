import {
  SettingsPage,
  SettingsPageContent,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"

export function FilesPendingSetupPage() {
  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <SettingsSection>
          <SettingsSectionTitle>Files</SettingsSectionTitle>
          <SettingsSectionDescription>
            Files will appear here once this workspace has a ready tenant runtime.
          </SettingsSectionDescription>
        </SettingsSection>
      </SettingsPageContent>
    </SettingsPage>
  )
}


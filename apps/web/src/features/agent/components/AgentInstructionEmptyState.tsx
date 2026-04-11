import {
  SettingsPage,
  SettingsPageContent,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function AgentInstructionEmptyState() {
  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <SettingsSection>
          <SettingsSectionTitle>Personalization</SettingsSectionTitle>
          <SettingsSectionDescription>
            These instruction files will appear once Otto has been set up for
            this workspace.
          </SettingsSectionDescription>
        </SettingsSection>

        <Card>
          <CardHeader>
            <CardTitle>Otto instructions</CardTitle>
            <CardDescription>
              Finish setup for this workspace to unlock Otto&apos;s
              personalization files.
            </CardDescription>
          </CardHeader>
        </Card>
      </SettingsPageContent>
    </SettingsPage>
  )
}

import type { WorkspaceIntegrationDetail } from "@otto/feature-integrations-runtime/workspace"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Badge } from "@/components/ui/badge"

export interface IntegrationStatusRowsProps {
  connectActionLabel: string
  connectUrl: string | null
  detail: WorkspaceIntegrationDetail
  statusLabel: string
  statusVariant: "default" | "destructive" | "outline" | "secondary"
}

export function IntegrationStatusRows({
  connectActionLabel,
  connectUrl,
  detail,
  statusLabel,
  statusVariant,
}: IntegrationStatusRowsProps) {
  return (
    <div className="mt-4 flex max-w-3xl flex-col gap-8">
      <SettingsSection>
        <SettingsSectionTitle>Connection</SettingsSectionTitle>
        <SettingsSectionDescription>
          See the current {detail.integration.label} connection for this
          workspace.
        </SettingsSectionDescription>
        <SettingsCard>
          <SettingsRow>
            <SettingsRowLabel>
              <SettingsRowTitle>Status</SettingsRowTitle>
              <SettingsRowDescription>
                Whether Otto can currently use {detail.integration.label} in
                this workspace.
              </SettingsRowDescription>
            </SettingsRowLabel>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </SettingsRow>
          <SettingsRow>
            <SettingsRowLabel>
              <SettingsRowTitle>Workspace</SettingsRowTitle>
              <SettingsRowDescription>
                The current workspace where this integration belongs.
              </SettingsRowDescription>
            </SettingsRowLabel>
            <span className="text-sm font-medium">
              {detail.connection.workspaceUrl?.split("/")[1]}
            </span>
          </SettingsRow>
          <SettingsRow>
            <SettingsRowLabel>
              <SettingsRowTitle>Last connected</SettingsRowTitle>
              <SettingsRowDescription>
                The most recent successful connection time.
              </SettingsRowDescription>
            </SettingsRowLabel>
            <span className="text-sm font-medium">
              {detail.summary?.connectedAt ?? "Not connected"}
            </span>
          </SettingsRow>
          <SettingsRow>
            <SettingsRowLabel>
              <SettingsRowTitle>Last update</SettingsRowTitle>
              <SettingsRowDescription>
                The latest update recorded for this integration.
              </SettingsRowDescription>
            </SettingsRowLabel>
            <span className="text-sm font-medium">
              {detail.summary?.lastErrorAt ?? "No recent activity"}
            </span>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection>
        <SettingsSectionTitle>Actions</SettingsSectionTitle>
        <SettingsSectionDescription>
          Manage the {detail.integration.label} connection for this workspace.
        </SettingsSectionDescription>
        <SettingsCard>
          <SettingsRow>
            <SettingsRowLabel>
              <SettingsRowTitle>{connectActionLabel}</SettingsRowTitle>
              <SettingsRowDescription>
                Open the provider flow for this workspace integration.
              </SettingsRowDescription>
            </SettingsRowLabel>
            {connectUrl ? (
              <a
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                href={connectUrl}
              >
                {connectActionLabel}
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">Unavailable</span>
            )}
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}

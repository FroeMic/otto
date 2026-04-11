import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { IntegrationCapabilitiesList } from "@/features/integrations/components/IntegrationCapabilitiesList"
import { IntegrationSettingsShell } from "@/features/integrations/components/IntegrationSettingsShell"
import type { WorkspaceIntegrationDetail } from "@/features/integrations/types"

import {
  buildBraveDefaultRows,
  buildBraveProviderRows,
  formatBraveAvailabilityLabel,
  formatBraveManagedByLabel,
  formatBraveProviderLabel,
  type BraveRuntimeConfig,
} from "../formatters"

export interface BraveIntegrationStatusPageProps {
  currentSection: string
  detail: WorkspaceIntegrationDetail
  onSectionChange: (section: string) => void
  orgSlug: string
}

function getBraveConfig(detail: WorkspaceIntegrationDetail): BraveRuntimeConfig {
  const config = detail.settings?.surface.config

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {}
  }

  return config as BraveRuntimeConfig
}

export function BraveIntegrationStatusPage({
  currentSection,
  detail,
  onSectionChange,
  orgSlug: _orgSlug,
}: BraveIntegrationStatusPageProps) {
  const config = getBraveConfig(detail)
  const hasStatusIssue =
    detail.connection.status.needsAttention ||
    detail.settings?.surface.availability !== "available" ||
    Boolean(detail.settings?.surface.blockingReason)
  const defaultRows = buildBraveDefaultRows(config)
  const providerRows = buildBraveProviderRows(config)

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 pb-12">
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <img alt="" className="size-8" src={detail.integration.iconSrc ?? ""} />
          <h1 className="text-3xl font-semibold tracking-tight">
            {detail.integration.label}
          </h1>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {detail.integration.pageDescription}
        </p>
      </section>

      <IntegrationSettingsShell
        capabilities={
          <SettingsPage className="mx-0 max-w-none">
            <div className="flex flex-col gap-8">
              <SettingsSection>
                <SettingsSectionTitle>Capabilities</SettingsSectionTitle>
                <SettingsSectionDescription>
                  These are the Brave-backed tools Otto can use in this workspace.
                </SettingsSectionDescription>
                <IntegrationCapabilitiesList rows={detail.capabilities} />
              </SettingsSection>
            </div>
          </SettingsPage>
        }
        configuration={
          <SettingsPage className="mx-0 max-w-none">
            <div className="flex flex-col gap-8">
              <SettingsSection>
                <SettingsSectionTitle>Search defaults</SettingsSectionTitle>
                <SettingsSectionDescription>
                  These are the default search settings Otto currently uses.
                </SettingsSectionDescription>
                <SettingsCard>
                  {defaultRows.map((row) => (
                    <SettingsRow key={row.title}>
                      <SettingsRowLabel>
                        <SettingsRowTitle>{row.title}</SettingsRowTitle>
                        {row.description ? (
                          <SettingsRowDescription>
                            {row.description}
                          </SettingsRowDescription>
                        ) : null}
                      </SettingsRowLabel>
                      <span className="text-sm text-muted-foreground">
                        {row.value}
                      </span>
                    </SettingsRow>
                  ))}
                </SettingsCard>
              </SettingsSection>

              <SettingsSection>
                <SettingsSectionTitle>Provider settings</SettingsSectionTitle>
                <SettingsSectionDescription>
                  These are the provider-specific values Otto currently uses.
                </SettingsSectionDescription>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Provider</SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {formatBraveProviderLabel(config.provider)}
                    </span>
                  </SettingsRow>
                  {providerRows.map((row) => (
                    <SettingsRow key={row.title}>
                      <SettingsRowLabel>
                        <SettingsRowTitle>{row.title}</SettingsRowTitle>
                        {row.description ? (
                          <SettingsRowDescription>
                            {row.description}
                          </SettingsRowDescription>
                        ) : null}
                      </SettingsRowLabel>
                      <span className="text-sm text-muted-foreground">
                        {row.value}
                      </span>
                    </SettingsRow>
                  ))}
                </SettingsCard>
              </SettingsSection>
            </div>
          </SettingsPage>
        }
        currentSection={currentSection}
        onSectionChange={onSectionChange}
        status={
          <SettingsPage className="mx-0 max-w-none">
            <div className="flex flex-col gap-8">
              {detail.settings?.surface.blockingReason ? (
                <Alert variant="destructive">
                  <AlertTitle>Brave is unavailable</AlertTitle>
                  <AlertDescription>
                    {detail.settings.surface.blockingReason}
                  </AlertDescription>
                </Alert>
              ) : null}

              <SettingsSection>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Status</SettingsRowTitle>
                      <SettingsRowDescription>
                        Otto can only use Brave search when a provider is configured.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Badge
                      variant={
                        detail.settings?.surface.availability === "available"
                          ? "outline"
                          : "destructive"
                      }
                    >
                      {formatBraveAvailabilityLabel(
                        detail.settings?.surface.availability,
                      )}
                    </Badge>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Provider</SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {formatBraveProviderLabel(config.provider)}
                    </span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>
                        Workspace configuration source
                      </SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {formatBraveManagedByLabel(config.managedBy)}
                    </span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Workspace edits</SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {detail.settings?.surface.canUserEdit
                        ? "Allowed"
                        : "Not allowed here"}
                    </span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Otto edits</SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {detail.settings?.surface.canAgentEdit
                        ? "Allowed"
                        : "Not allowed here"}
                    </span>
                  </SettingsRow>
                  {hasStatusIssue ? (
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Attention</SettingsRowTitle>
                        <SettingsRowDescription>
                          Otto cannot rely on Brave search until the issue below is resolved.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <Badge variant="destructive">Needs attention</Badge>
                    </SettingsRow>
                  ) : null}
                </SettingsCard>
              </SettingsSection>
            </div>
          </SettingsPage>
        }
      />
    </div>
  )
}

import { useQueryClient } from "@tanstack/react-query"
import { useState, useTransition } from "react"

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
import { Button, buttonVariants } from "@/components/ui/button"
import { disconnectWorkspaceIntegration } from "@/features/integrations/api/integrations"
import { IntegrationCapabilitiesTable } from "@/features/integrations/components/IntegrationCapabilitiesTable"
import { IntegrationSettingsShell } from "@/features/integrations/components/IntegrationSettingsShell"
import type { WorkspaceIntegrationDetail } from "@/features/integrations/types"

import { GitHubIntegrationIcon } from "../GitHubIntegrationIcon"

export interface GitHubIntegrationStatusPageProps {
  currentSection: string
  detail: WorkspaceIntegrationDetail
  onSectionChange: (section: string) => void
  orgSlug: string
}

function getRepositoryCount(detail: WorkspaceIntegrationDetail) {
  const value = detail.setupState?.repositoryCount

  return typeof value === "number" ? value : 0
}

function getAccountLogin(detail: WorkspaceIntegrationDetail) {
  const value = detail.setupState?.accountLogin

  return typeof value === "string" ? value : "Not connected"
}

export function GitHubIntegrationStatusPage({
  currentSection,
  detail,
  onSectionChange,
  orgSlug,
}: GitHubIntegrationStatusPageProps) {
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const connected = detail.connection.status.connected
  const needsAttention = detail.connection.status.needsAttention
  const statusLabel = needsAttention
    ? "Needs attention"
    : connected
      ? "Connected"
      : "Not connected"
  const connectActionLabel =
    connected || needsAttention ? "Reconnect" : "Connect"

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ["workspace-integrations", orgSlug],
    })
    void queryClient.invalidateQueries({
      queryKey: [
        "workspace-integration-detail",
        orgSlug,
        detail.integration.key,
      ],
    })
  }

  function handleDisconnect() {
    if (
      !window.confirm(
        "Disconnect GitHub from this workspace? The assistant will stop using selected repositories until you reconnect.",
      )
    ) {
      return
    }

    startTransition(() => {
      void disconnectWorkspaceIntegration({
        integrationKey: detail.integration.key,
        orgSlug,
      })
        .then(() => {
          setErrorMessage(null)
          setSuccessMessage("GitHub has been disconnected.")
          invalidate()
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error ? error.message : "GitHub request failed",
          )
        })
    })
  }

  return (
    <div className="flex w-full max-w-none flex-col gap-6 pb-12">
      <section className="flex max-w-3xl flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <GitHubIntegrationIcon alt="" className="size-8" />
              <h1 className="text-3xl font-semibold tracking-tight">
                {detail.integration.label}
              </h1>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {detail.integration.pageDescription}
            </p>
          </div>
        </div>
      </section>

      {detail.summary?.lastError ? (
        <Alert variant="destructive">
          <AlertTitle>GitHub needs attention</AlertTitle>
          <AlertDescription>{detail.summary.lastError}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert>
          <AlertTitle>Update complete</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Update failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <IntegrationSettingsShell
        capabilities={
          <div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col">
            <IntegrationCapabilitiesTable
              integrationKey={detail.integration.key}
              onUpdated={invalidate}
              orgSlug={orgSlug}
              rows={detail.capabilities}
            />
          </div>
        }
        currentSection={currentSection}
        onSectionChange={onSectionChange}
        status={
          <SettingsPage className="mx-0 mt-4 max-w-3xl">
            <div className="flex flex-col gap-8">
              <SettingsSection>
                <SettingsSectionTitle>Connection</SettingsSectionTitle>
                <SettingsSectionDescription>
                  See the current GitHub App installation for this workspace.
                </SettingsSectionDescription>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Status</SettingsRowTitle>
                      <SettingsRowDescription>
                        Whether selected repositories are available.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Badge
                      variant={
                        needsAttention
                          ? "destructive"
                          : connected
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {statusLabel}
                    </Badge>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Account</SettingsRowTitle>
                      <SettingsRowDescription>
                        The GitHub account or organization installed for this
                        workspace.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <span className="text-sm font-medium">
                      {getAccountLogin(detail)}
                    </span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Repositories</SettingsRowTitle>
                      <SettingsRowDescription>
                        Repositories currently cached from the installation.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <span className="text-sm font-medium">
                      {getRepositoryCount(detail)}
                    </span>
                  </SettingsRow>
                </SettingsCard>
              </SettingsSection>

              <SettingsSection>
                <SettingsSectionTitle>Actions</SettingsSectionTitle>
                <SettingsSectionDescription>
                  Manage the GitHub App connection for this workspace.
                </SettingsSectionDescription>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Connect GitHub</SettingsRowTitle>
                      <SettingsRowDescription>
                        Install or update the GitHub App and select
                        repositories.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    {detail.connection.connectUrl ? (
                      <a
                        className={buttonVariants()}
                        href={detail.connection.connectUrl}
                      >
                        {connectActionLabel}
                      </a>
                    ) : (
                      <Button disabled type="button">
                        {connectActionLabel}
                      </Button>
                    )}
                  </SettingsRow>
                  {connected || needsAttention ? (
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Disconnect GitHub</SettingsRowTitle>
                        <SettingsRowDescription>
                          Remove the current GitHub connection from this
                          workspace.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <Button
                        disabled={isPending}
                        onClick={handleDisconnect}
                        type="button"
                        variant="outline"
                      >
                        Disconnect
                      </Button>
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

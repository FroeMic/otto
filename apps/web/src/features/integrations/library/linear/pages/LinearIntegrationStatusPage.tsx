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
import { Button } from "@/components/ui/button"
import { IntegrationCapabilitiesTable } from "@/features/integrations/components/IntegrationCapabilitiesTable"
import { IntegrationSettingsShell } from "@/features/integrations/components/IntegrationSettingsShell"
import { disconnectWorkspaceIntegration } from "@/features/integrations/api/integrations"
import type { WorkspaceIntegrationDetail } from "@/features/integrations/types"

export interface LinearIntegrationStatusPageProps {
  currentSection: string
  detail: WorkspaceIntegrationDetail
  onSectionChange: (section: string) => void
  orgSlug: string
}

type LinearIntegrationUiState =
  | "connected"
  | "disabled"
  | "disconnected"
  | "needs_attention"

function getUiState(detail: WorkspaceIntegrationDetail): LinearIntegrationUiState {
  if (detail.summary?.lastError || detail.summary?.status === "error") {
    return "needs_attention"
  }

  if (detail.summary?.status === "disabled") {
    return "disabled"
  }

  if (detail.connection.status.connected) {
    return "connected"
  }

  return "disconnected"
}

function getStatusBadgeVariant(state: LinearIntegrationUiState) {
  switch (state) {
    case "connected":
      return "outline" as const
    case "needs_attention":
      return "destructive" as const
    case "disabled":
    case "disconnected":
      return "secondary" as const
  }
}

function getStatusLabel(state: LinearIntegrationUiState) {
  switch (state) {
    case "connected":
      return "Connected"
    case "disabled":
      return "Disabled"
    case "needs_attention":
      return "Needs attention"
    case "disconnected":
      return "Not connected"
  }
}

function getStatusAlert(input: {
  error: string | null
  state: LinearIntegrationUiState
}) {
  if (input.state === "needs_attention") {
    return {
      description:
        input.error ??
        "Reconnect Linear to restore access for Otto in this workspace.",
      title: "Linear needs attention",
      variant: "destructive" as const,
    }
  }

  if (input.state === "disconnected") {
    return {
      description:
        "Add Linear so Otto can search issues, review project context, and help draft follow-up work.",
      title: "Connect Linear",
      variant: "default" as const,
    }
  }

  if (input.state === "disabled") {
    return {
      description:
        "Linear is available for this workspace, but it is not active right now.",
      title: "Linear is turned off",
      variant: "default" as const,
    }
  }

  return null
}

export function LinearIntegrationStatusPage({
  currentSection,
  detail,
  onSectionChange,
  orgSlug,
}: LinearIntegrationStatusPageProps) {
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const uiState = getUiState(detail)
  const statusAlert = getStatusAlert({
    error: detail.summary?.lastError ?? null,
    state: uiState,
  })
  const statusLabel = getStatusLabel(uiState)
  const connectActionLabel =
    uiState === "connected" || uiState === "needs_attention"
      ? "Reconnect Linear"
      : "Connect Linear"

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ["workspace-integrations", orgSlug],
    })
    void queryClient.invalidateQueries({
      queryKey: ["workspace-integration-detail", orgSlug, detail.integration.key],
    })
  }

  function handleDisconnect() {
    if (
      !window.confirm(
        "Disconnect Linear from this workspace? Otto will stop using it until you reconnect.",
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
          setSuccessMessage("Linear has been disconnected.")
          invalidate()
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error ? error.message : "Linear request failed",
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
              <img alt="" className="size-8" src={detail.integration.iconSrc ?? ""} />
              <h1 className="text-3xl font-semibold tracking-tight">
                {detail.integration.label}
              </h1>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {detail.integration.pageDescription}
            </p>
          </div>
          <Badge variant={getStatusBadgeVariant(uiState)}>{statusLabel}</Badge>
        </div>
      </section>

      {statusAlert ? (
        <Alert variant={statusAlert.variant}>
          <AlertTitle>{statusAlert.title}</AlertTitle>
          <AlertDescription>{statusAlert.description}</AlertDescription>
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
                  See the current Linear connection for this workspace.
                </SettingsSectionDescription>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Status</SettingsRowTitle>
                      <SettingsRowDescription>
                        Whether Otto can currently use Linear in this workspace.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Badge variant={getStatusBadgeVariant(uiState)}>
                      {statusLabel}
                    </Badge>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Workspace</SettingsRowTitle>
                      <SettingsRowDescription>
                        The current workspace where this integration belongs.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <span className="text-sm font-medium">
                      {orgSlug}
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
                        The latest update recorded for this Linear connection.
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
                  Manage the Linear connection for this workspace.
                </SettingsSectionDescription>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Connect Linear</SettingsRowTitle>
                      <SettingsRowDescription>
                        Add Linear so Otto can search issues and help draft follow-up work.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    {detail.connection.connectUrl ? (
                      <a className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" href={detail.connection.connectUrl}>
                        {connectActionLabel}
                      </a>
                    ) : (
                      <Button disabled type="button">
                        {connectActionLabel}
                      </Button>
                    )}
                  </SettingsRow>
                  {uiState === "connected" || uiState === "needs_attention" ? (
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Disconnect Linear</SettingsRowTitle>
                        <SettingsRowDescription>
                          Remove the current Linear connection from this workspace.
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

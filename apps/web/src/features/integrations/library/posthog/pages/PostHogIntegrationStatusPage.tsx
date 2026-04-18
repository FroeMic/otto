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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { disconnectWorkspaceIntegration } from "@/features/integrations/api/integrations"
import { IntegrationApiKeySetupFlow } from "@/features/integrations/components/IntegrationApiKeySetupFlow"
import { IntegrationCapabilitiesTable } from "@/features/integrations/components/IntegrationCapabilitiesTable"
import { IntegrationSettingsShell } from "@/features/integrations/components/IntegrationSettingsShell"
import type { WorkspaceIntegrationDetail } from "@/features/integrations/types"

export interface PostHogIntegrationStatusPageProps {
  currentSection: string
  detail: WorkspaceIntegrationDetail
  onSectionChange: (section: string) => void
  orgSlug: string
}

function getStatusLabel(detail: WorkspaceIntegrationDetail) {
  if (detail.connection.status.needsAttention) {
    return "Needs attention"
  }

  if (detail.connection.status.connected) {
    return "Connected"
  }

  return "Not connected"
}

function getStatusVariant(detail: WorkspaceIntegrationDetail) {
  if (detail.connection.status.needsAttention) {
    return "destructive" as const
  }

  if (detail.connection.status.connected) {
    return "outline" as const
  }

  return "secondary" as const
}

function getStateRecord(detail: WorkspaceIntegrationDetail) {
  return detail.setupState &&
    typeof detail.setupState === "object" &&
    !Array.isArray(detail.setupState)
    ? detail.setupState
    : null
}

function getSetupRecord(detail: WorkspaceIntegrationDetail) {
  const state = getStateRecord(detail)
  const setup = state?.setup

  return setup && typeof setup === "object" && !Array.isArray(setup)
    ? (setup as Record<string, unknown>)
    : null
}

function getSelectedResourceLabels(detail: WorkspaceIntegrationDetail) {
  const setup = getSetupRecord(detail)
  const selectedKeys = Array.isArray(setup?.selectedResourceKeys)
    ? setup.selectedResourceKeys.filter((key): key is string => typeof key === "string")
    : []
  const resources = Array.isArray(setup?.resources)
    ? setup.resources.filter(
        (resource): resource is Record<string, unknown> =>
          Boolean(resource && typeof resource === "object" && !Array.isArray(resource)),
      )
    : []

  return selectedKeys.flatMap((key) => {
    const resource = resources.find((entry) => entry.key === key)
    const label = resource?.label

    return typeof label === "string" && label.trim() ? [label] : [key]
  })
}

function getDefaultResourceLabel(detail: WorkspaceIntegrationDetail) {
  const setup = getSetupRecord(detail)
  const defaultKey =
    typeof setup?.defaultResourceKey === "string" ? setup.defaultResourceKey : null
  const resources = Array.isArray(setup?.resources)
    ? setup.resources.filter(
        (resource): resource is Record<string, unknown> =>
          Boolean(resource && typeof resource === "object" && !Array.isArray(resource)),
      )
    : []

  if (!defaultKey) {
    return null
  }

  const resource = resources.find((entry) => entry.key === defaultKey)
  const label = resource?.label

  return typeof label === "string" && label.trim() ? label : defaultKey
}

export function PostHogIntegrationStatusPage({
  currentSection,
  detail,
  onSectionChange,
  orgSlug,
}: PostHogIntegrationStatusPageProps) {
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const connected = detail.connection.status.connected
  const selectedResources = getSelectedResourceLabels(detail)
  const defaultResource = getDefaultResourceLabel(detail)

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
        "Disconnect PostHog from this workspace? Otto will stop using it until you reconnect.",
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
          setSuccessMessage("PostHog has been disconnected.")
          invalidate()
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error ? error.message : "PostHog request failed",
          )
        })
    })
  }

  return (
    <div className="flex w-full max-w-none flex-col gap-6 pb-12">
      <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
        <DialogContent className="max-h-[min(52rem,calc(100vh-2rem))] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Discover PostHog workspace</DialogTitle>
            <DialogDescription>
              Enter a Personal API key, discover the PostHog projects Otto can
              use, then save the selected projects and capabilities.
            </DialogDescription>
          </DialogHeader>
          <IntegrationApiKeySetupFlow
            detail={detail}
            onConnected={() => {
              setSuccessMessage(
                connected
                  ? "PostHog workspace configuration has been updated."
                  : "PostHog has been connected.",
              )
              setIsSetupDialogOpen(false)
              invalidate()
            }}
            orgSlug={orgSlug}
          />
        </DialogContent>
      </Dialog>

      <section className="flex max-w-3xl flex-col gap-4">
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
      </section>

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
          connected ? (
            <div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col">
              <IntegrationCapabilitiesTable
                integrationKey={detail.integration.key}
                onUpdated={invalidate}
                orgSlug={orgSlug}
                rows={detail.capabilities}
              />
            </div>
          ) : (
            <SettingsPage className="mx-0 mt-4 max-w-3xl">
              <SettingsSection>
                <SettingsSectionTitle>Connect PostHog first</SettingsSectionTitle>
                <SettingsSectionDescription>
                  Capabilities are based on access detected from the Personal API
                  key. Complete setup before configuring them.
                </SettingsSectionDescription>
              </SettingsSection>
            </SettingsPage>
          )
        }
        capabilitiesLocked={!connected}
        capabilitiesLockedReason="Connect PostHog before configuring capabilities."
        currentSection={currentSection}
        onSectionChange={onSectionChange}
        status={
          <SettingsPage className="mx-0 mt-4 max-w-3xl">
            {connected ? (
              <div className="flex flex-col gap-8">
                <SettingsSection>
                  <SettingsSectionTitle>Connection</SettingsSectionTitle>
                  <SettingsSectionDescription>
                    PostHog is connected for this workspace. Otto can use the
                    selected projects and enabled capabilities.
                  </SettingsSectionDescription>
                  <SettingsCard>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Status</SettingsRowTitle>
                        <SettingsRowDescription>
                          Whether Otto can currently use PostHog in this workspace.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <Badge variant={getStatusVariant(detail)}>
                        {getStatusLabel(detail)}
                      </Badge>
                    </SettingsRow>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Projects Otto can use</SettingsRowTitle>
                        <SettingsRowDescription>
                          Selected during setup and stored as integration state.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <div className="flex max-w-sm flex-wrap gap-2">
                        {selectedResources.length > 0 ? (
                          selectedResources.map((resource) => (
                            <Badge key={resource} variant="secondary">
                              {resource}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No projects recorded.
                          </span>
                        )}
                      </div>
                    </SettingsRow>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Default project</SettingsRowTitle>
                        <SettingsRowDescription>
                          Used when a request does not name a specific project.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <span className="text-sm text-muted-foreground">
                        {defaultResource ?? "Not recorded"}
                      </span>
                    </SettingsRow>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Discover workspace</SettingsRowTitle>
                        <SettingsRowDescription>
                          Re-run discovery when the PostHog API key, project
                          selection, or capability access changes.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <Button
                        onClick={() => setIsSetupDialogOpen(true)}
                        type="button"
                        variant="outline"
                      >
                        Discover workspace
                      </Button>
                    </SettingsRow>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Disconnect PostHog</SettingsRowTitle>
                        <SettingsRowDescription>
                          Remove the current PostHog API key from this workspace.
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
                  </SettingsCard>
                </SettingsSection>
              </div>
            ) : (
              <SettingsSection>
                <SettingsSectionTitle>Connect PostHog</SettingsSectionTitle>
                <SettingsSectionDescription>
                  Start discovery with a Personal API key, choose the projects
                  Otto may use, and save the detected capabilities.
                </SettingsSectionDescription>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Discover workspace</SettingsRowTitle>
                      <SettingsRowDescription>
                        Otto validates the key and detects available PostHog
                        projects and capabilities before saving anything.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Button
                      onClick={() => setIsSetupDialogOpen(true)}
                      type="button"
                    >
                      Discover workspace
                    </Button>
                  </SettingsRow>
                </SettingsCard>
              </SettingsSection>
            )}
          </SettingsPage>
        }
      />
    </div>
  )
}

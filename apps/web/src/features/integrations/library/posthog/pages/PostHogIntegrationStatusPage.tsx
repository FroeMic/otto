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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  connectWorkspaceApiKeyIntegration,
  disconnectWorkspaceIntegration,
} from "@/features/integrations/api/integrations"
import { IntegrationCapabilitiesTable } from "@/features/integrations/components/IntegrationCapabilitiesTable"
import { IntegrationSettingsShell } from "@/features/integrations/components/IntegrationSettingsShell"
import type { WorkspaceIntegrationDetail } from "@/features/integrations/types"

export interface PostHogIntegrationStatusPageProps {
  currentSection: string
  detail: WorkspaceIntegrationDetail
  onSectionChange: (section: string) => void
  orgSlug: string
}

const DEFAULT_SCOPES = [
  "project:read",
  "query:read",
  "insight:read",
  "insight:write",
  "dashboard:read",
  "feature_flag:read",
  "feature_flag:write",
  "activity_log:read",
  "experiment:read",
  "experiment:write",
  "annotation:read",
  "annotation:write",
  "event_definition:read",
  "property_definition:read",
  "action:read",
  "person:read",
  "session_recording:read",
]

const DEFAULT_TARGETS = JSON.stringify(
  [
    {
      environmentId: "",
      key: "production",
      label: "Production",
      organizationId: "",
      projectId: "",
    },
  ],
  null,
  2,
)

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

function parseScopes(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseTargets(value: string) {
  const parsed = JSON.parse(value) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error("Targets must be a JSON array.")
  }

  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Every target must be an object.")
    }

    const target = entry as Record<string, unknown>

    return {
      environmentId:
        typeof target.environmentId === "string" && target.environmentId.trim()
          ? target.environmentId.trim()
          : undefined,
      key: String(target.key ?? "").trim(),
      label: String(target.label ?? "").trim(),
      organizationId:
        typeof target.organizationId === "string" && target.organizationId.trim()
          ? target.organizationId.trim()
          : undefined,
      projectId:
        typeof target.projectId === "string" && target.projectId.trim()
          ? target.projectId.trim()
          : undefined,
    }
  })
}

export function PostHogIntegrationStatusPage({
  currentSection,
  detail,
  onSectionChange,
  orgSlug,
}: PostHogIntegrationStatusPageProps) {
  const queryClient = useQueryClient()
  const [host, setHost] = useState("https://us.posthog.com")
  const [apiKey, setApiKey] = useState("")
  const [declaredScopes, setDeclaredScopes] = useState(DEFAULT_SCOPES.join("\n"))
  const [defaultTargetKey, setDefaultTargetKey] = useState("production")
  const [targets, setTargets] = useState(DEFAULT_TARGETS)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ["workspace-integrations", orgSlug],
    })
    void queryClient.invalidateQueries({
      queryKey: ["workspace-integration-detail", orgSlug, detail.integration.key],
    })
  }

  function handleConnect() {
    let parsedTargets: ReturnType<typeof parseTargets>

    try {
      parsedTargets = parseTargets(targets)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "PostHog targets are invalid.",
      )
      return
    }

    startTransition(() => {
      void connectWorkspaceApiKeyIntegration({
        apiKey,
        declaredScopes: parseScopes(declaredScopes),
        defaultTargetKey,
        host,
        integrationKey: detail.integration.key,
        orgSlug,
        targets: parsedTargets,
      })
        .then(() => {
          setApiKey("")
          setErrorMessage(null)
          setSuccessMessage("PostHog has been connected for this workspace.")
          invalidate()
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error ? error.message : "PostHog request failed",
          )
        })
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
                  Connect PostHog with a personal API key and one or more
                  analytics targets.
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
                      <SettingsRowTitle>Host</SettingsRowTitle>
                      <SettingsRowDescription>
                        Use the PostHog Cloud region or your self-hosted origin.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Input
                      className="max-w-sm"
                      onChange={(event) => setHost(event.target.value)}
                      value={host}
                    />
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>API key</SettingsRowTitle>
                      <SettingsRowDescription>
                        Paste a personal API key with the scopes Otto should use.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Input
                      className="max-w-sm"
                      onChange={(event) => setApiKey(event.target.value)}
                      type="password"
                      value={apiKey}
                    />
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Default target</SettingsRowTitle>
                      <SettingsRowDescription>
                        The target Otto should use when a command does not name one.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Input
                      className="max-w-sm"
                      onChange={(event) => setDefaultTargetKey(event.target.value)}
                      value={defaultTargetKey}
                    />
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Declared scopes</SettingsRowTitle>
                      <SettingsRowDescription>
                        One scope per line or comma-separated.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Textarea
                      className="min-h-44 max-w-sm font-mono text-xs"
                      onChange={(event) => setDeclaredScopes(event.target.value)}
                      value={declaredScopes}
                    />
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Targets</SettingsRowTitle>
                      <SettingsRowDescription>
                        JSON array of PostHog organization, project, and environment ids.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Textarea
                      className="min-h-52 max-w-sm font-mono text-xs"
                      onChange={(event) => setTargets(event.target.value)}
                      value={targets}
                    />
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Connect PostHog</SettingsRowTitle>
                      <SettingsRowDescription>
                        Save the encrypted API key and target configuration.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Button disabled={isPending || !apiKey.trim()} onClick={handleConnect}>
                      {detail.connection.status.connected ? "Reconnect" : "Connect"}
                    </Button>
                  </SettingsRow>
                  {detail.connection.status.connected ? (
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

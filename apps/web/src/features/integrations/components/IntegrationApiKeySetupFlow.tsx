import { ArrowSquareOut } from "@phosphor-icons/react"
import { useMemo, useState, useTransition } from "react"

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import {
  applyWorkspaceIntegrationSetup,
  discoverWorkspaceIntegrationSetup,
} from "@/features/integrations/api/integrations"
import type {
  WorkspaceIntegrationDetail,
  WorkspaceIntegrationSetupDiscoverResponse,
} from "@/features/integrations/types"

export interface IntegrationApiKeySetupFlowProps {
  detail: WorkspaceIntegrationDetail
  onConnected: () => void
  orgSlug: string
}

type SetupResource =
  WorkspaceIntegrationSetupDiscoverResponse["resources"][number]

type CapabilityRecommendation =
  WorkspaceIntegrationSetupDiscoverResponse["capabilityRecommendations"][number]

function buildCredentialHelpUrl(template: string | undefined, host: string) {
  if (!template) {
    return null
  }

  try {
    const origin = new URL(host.trim()).origin

    return template.replace("{host}", origin)
  } catch {
    return null
  }
}

function getCapabilityBadgeVariant(
  status: CapabilityRecommendation["status"],
) {
  if (status === "unavailable") {
    return "secondary" as const
  }

  if (status === "sensitive") {
    return "outline" as const
  }

  return "default" as const
}

function getCapabilityStatusLabel(status: CapabilityRecommendation["status"]) {
  switch (status) {
    case "available":
      return "Available"
    case "recommended":
      return "Recommended"
    case "sensitive":
      return "Sensitive"
    case "unavailable":
      return "Unavailable"
  }
}

export function IntegrationApiKeySetupFlow({
  detail,
  onConnected,
  orgSlug,
}: IntegrationApiKeySetupFlowProps) {
  const setup = detail.setup
  const [host, setHost] = useState(setup?.host?.defaultValue ?? "")
  const [apiKey, setApiKey] = useState("")
  const [discovery, setDiscovery] =
    useState<WorkspaceIntegrationSetupDiscoverResponse | null>(null)
  const [selectedResourceKeys, setSelectedResourceKeys] = useState<string[]>([])
  const [defaultResourceKey, setDefaultResourceKey] = useState("")
  const [enabledCapabilityKeys, setEnabledCapabilityKeys] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const credentialHelpUrl = buildCredentialHelpUrl(
    setup?.credential.helpUrlTemplate,
    host,
  )
  const selectedResources = useMemo(
    () =>
      discovery?.resources.filter((resource) =>
        selectedResourceKeys.includes(resource.key),
      ) ?? [],
    [discovery, selectedResourceKeys],
  )
  const canSave =
    Boolean(discovery) &&
    selectedResourceKeys.length > 0 &&
    Boolean(defaultResourceKey) &&
    enabledCapabilityKeys.length > 0

  if (!setup) {
    return null
  }
  const setupDefinition = setup

  function toggleResource(resource: SetupResource) {
    setSelectedResourceKeys((current) => {
      const next = current.includes(resource.key)
        ? current.filter((key) => key !== resource.key)
        : [...current, resource.key]

      if (!next.includes(defaultResourceKey)) {
        setDefaultResourceKey(next[0] ?? "")
      }

      return next
    })
  }

  function toggleCapability(capability: CapabilityRecommendation) {
    if (capability.status === "unavailable") {
      return
    }

    setEnabledCapabilityKeys((current) =>
      current.includes(capability.capabilityKey)
        ? current.filter((key) => key !== capability.capabilityKey)
        : [...current, capability.capabilityKey],
    )
  }

  function handleDiscover() {
    startTransition(() => {
      void discoverWorkspaceIntegrationSetup({
        apiKey,
        host,
        integrationKey: detail.integration.key,
        orgSlug,
      })
        .then((result) => {
          const defaultResources = result.resources.filter(
            (resource) => resource.selectedByDefault,
          )
          const selected =
            setupDefinition.discovery.defaultResourceSelectionMode === "all"
              ? result.resources.map((resource) => resource.key)
              : setupDefinition.discovery.defaultResourceSelectionMode === "first"
                ? [defaultResources[0]?.key ?? result.resources[0]?.key].filter(
                    Boolean,
                  )
                : []
          const defaultKey = selected[0] ?? ""

          setDiscovery(result)
          setSelectedResourceKeys(selected)
          setDefaultResourceKey(defaultKey)
          setEnabledCapabilityKeys(
            result.capabilityRecommendations
              .filter((capability) => capability.defaultEnabled)
              .map((capability) => capability.capabilityKey),
          )
          setErrorMessage(null)
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : `${detail.integration.label} setup discovery failed.`,
          )
        })
    })
  }

  function handleApply() {
    startTransition(() => {
      void applyWorkspaceIntegrationSetup({
        apiKey,
        defaultResourceKey,
        enabledCapabilityKeys,
        host,
        integrationKey: detail.integration.key,
        orgSlug,
        selectedResourceKeys,
      })
        .then(() => {
          setApiKey("")
          setErrorMessage(null)
          onConnected()
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : `${detail.integration.label} setup failed.`,
          )
        })
    })
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Setup failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsSection>
        <SettingsSectionTitle>Setup</SettingsSectionTitle>
        <SettingsSectionDescription>
          Connect with an API key, let Otto discover the workspace, then choose
          the resources and capabilities Otto may use.
        </SettingsSectionDescription>
        <SettingsCard>
          {setup.host ? (
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>{setup.host.label}</SettingsRowTitle>
                <SettingsRowDescription>{setup.host.helpText}</SettingsRowDescription>
              </SettingsRowLabel>
              <Input
                className="max-w-sm"
                onChange={(event) => {
                  setHost(event.target.value)
                  setDiscovery(null)
                }}
                placeholder={setup.host.placeholder}
                value={host}
              />
            </SettingsRow>
          ) : null}

          <SettingsRow>
            <SettingsRowLabel>
              <SettingsRowTitle>{setup.credential.label}</SettingsRowTitle>
              <SettingsRowDescription>
                Use a Personal API key. Project API keys cannot read or manage
                private integration resources.
              </SettingsRowDescription>
            </SettingsRowLabel>
            <div className="flex w-full max-w-sm flex-col gap-3">
              {credentialHelpUrl ? (
                <Button
                  className="w-fit"
                  onClick={() => window.open(credentialHelpUrl, "_blank", "noreferrer")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Open API keys
                  <ArrowSquareOut className="size-4" />
                </Button>
              ) : null}
              <Input
                onChange={(event) => {
                  setApiKey(event.target.value)
                  setDiscovery(null)
                }}
                placeholder={setup.credential.placeholder}
                type="password"
                value={apiKey}
              />
            </div>
          </SettingsRow>

          <SettingsRow>
            <SettingsRowLabel>
              <SettingsRowTitle>Discover workspace</SettingsRowTitle>
              <SettingsRowDescription>
                Otto validates the key and detects available resources and access.
              </SettingsRowDescription>
            </SettingsRowLabel>
            <Button disabled={isPending || !apiKey.trim()} onClick={handleDiscover}>
              {isPending && !discovery ? "Testing..." : setup.discovery.actionLabel}
            </Button>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {discovery ? (
        <>
          <SettingsSection>
            <SettingsSectionTitle>Discovered Workspace</SettingsSectionTitle>
            <SettingsSectionDescription>
              Select the resources Otto may use. The default resource is used
              when a request does not name one.
            </SettingsSectionDescription>
            <SettingsCard>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Account</SettingsRowTitle>
                  <SettingsRowDescription>
                    The account returned by the integration during discovery.
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <span className="text-sm text-muted-foreground">
                  {discovery.account?.label ?? "Authenticated"}
                </span>
              </SettingsRow>

              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>
                    {setup.discovery.resourceSelectionLabel}
                  </SettingsRowTitle>
                  <SettingsRowDescription>
                    Choose one or more resources for Otto.
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <div className="flex w-full max-w-sm flex-col gap-2">
                  {discovery.resources.length > 0 ? (
                    discovery.resources.map((resource) => (
                      <label
                        className="flex items-start gap-3 rounded-md border bg-background px-3 py-2"
                        key={resource.key}
                      >
                        <Checkbox
                          checked={selectedResourceKeys.includes(resource.key)}
                          onCheckedChange={() => toggleResource(resource)}
                        />
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-sm font-medium">
                            {resource.label}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {resource.type} · {resource.id}
                          </span>
                        </span>
                      </label>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No selectable resources were discovered.
                    </span>
                  )}
                </div>
              </SettingsRow>

              {selectedResources.length > 0 ? (
                <SettingsRow>
                  <SettingsRowLabel>
                    <SettingsRowTitle>Default resource</SettingsRowTitle>
                    <SettingsRowDescription>
                      Otto uses this when a request does not specify a resource.
                    </SettingsRowDescription>
                  </SettingsRowLabel>
                  <NativeSelect
                    className="w-full max-w-sm"
                    onChange={(event) => setDefaultResourceKey(event.target.value)}
                    value={defaultResourceKey}
                  >
                    {selectedResources.map((resource) => (
                      <NativeSelectOption key={resource.key} value={resource.key}>
                        {resource.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </SettingsRow>
              ) : null}
            </SettingsCard>
          </SettingsSection>

          <SettingsSection>
            <SettingsSectionTitle>Detected Access</SettingsSectionTitle>
            <SettingsSectionDescription>
              Review the capabilities Otto can use with this key. Sensitive and
              write access starts off unless you enable it.
            </SettingsSectionDescription>
            <SettingsCard>
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {discovery.capabilityRecommendations.map((capability) => (
                  <label
                    className="flex min-w-0 items-start gap-3 rounded-md border bg-background px-3 py-2"
                    key={capability.capabilityKey}
                  >
                    <Checkbox
                      checked={enabledCapabilityKeys.includes(
                        capability.capabilityKey,
                      )}
                      disabled={capability.status === "unavailable"}
                      onCheckedChange={() => toggleCapability(capability)}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {capability.label}
                        </span>
                        <Badge
                          className="shrink-0"
                          variant={getCapabilityBadgeVariant(capability.status)}
                        >
                          {getCapabilityStatusLabel(capability.status)}
                        </Badge>
                      </span>
                      {capability.reason ? (
                        <span className="text-xs text-muted-foreground">
                          {capability.reason}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Save connection</SettingsRowTitle>
                  <SettingsRowDescription>
                    Store the encrypted key and apply the selected resource and
                    capability settings.
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <Button disabled={isPending || !canSave} onClick={handleApply}>
                  {isPending && discovery ? "Saving..." : "Save connection"}
                </Button>
              </SettingsRow>
            </SettingsCard>
          </SettingsSection>
        </>
      ) : null}
    </div>
  )
}

import { CaretDown } from "@phosphor-icons/react"
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  applyWorkspaceIntegrationSetup,
  discoverWorkspaceIntegrationSetup,
} from "@/features/integrations/api/integrations"
import type {
  WorkspaceIntegrationDetail,
  WorkspaceIntegrationSetupDiscoverResponse,
} from "@/features/integrations/types"
import { cn } from "@/lib/utils"

export interface IntegrationApiKeySetupFlowProps {
  detail: WorkspaceIntegrationDetail
  onConnected: () => void
  orgSlug: string
}

type SetupResource =
  WorkspaceIntegrationSetupDiscoverResponse["resources"][number]

type CapabilityRecommendation =
  WorkspaceIntegrationSetupDiscoverResponse["capabilityRecommendations"][number]

const capabilityGroupLabels: Record<string, string> = {
  annotation: "Annotations",
  dashboard: "Dashboards",
  experiment: "Experiments",
  feature_flag: "Feature Flags",
  insight: "Insights",
  person: "Persons",
  query: "Query",
  session_recording: "Session Recordings",
  taxonomy: "Taxonomy",
  workspace: "Workspace",
}

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

function getCapabilityGroupKey(capability: CapabilityRecommendation) {
  return capability.capabilityKey.split(".")[0] ?? "other"
}

function getCapabilityGroupLabel(groupKey: string) {
  return capabilityGroupLabels[groupKey] ?? groupKey
}

function getGroupedCapabilities(capabilities: CapabilityRecommendation[]) {
  const groups = new Map<string, CapabilityRecommendation[]>()

  for (const capability of capabilities) {
    const groupKey = getCapabilityGroupKey(capability)
    const current = groups.get(groupKey) ?? []
    current.push(capability)
    groups.set(groupKey, current)
  }

  return [...groups.entries()]
    .map(([groupKey, entries]) => ({
      entries: entries.sort((left, right) => left.label.localeCompare(right.label)),
      groupKey,
      label: getCapabilityGroupLabel(groupKey),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

function getResourceSummary(
  resources: SetupResource[],
  selectedResourceKeys: string[],
) {
  if (selectedResourceKeys.length === 0) {
    return "Select projects"
  }

  const labelByKey = new Map(
    resources.map((resource) => [resource.key, resource.label]),
  )

  return selectedResourceKeys
    .map((key) => labelByKey.get(key) ?? key)
    .sort((left, right) => left.localeCompare(right))
    .join(", ")
}

function filterResources(resources: SetupResource[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return resources
  }

  return resources.filter((resource) =>
    `${resource.label} ${resource.id} ${resource.type} ${resource.key}`
      .toLowerCase()
      .includes(normalizedQuery),
  )
}

function toggleResourceSelection(selectedResourceKeys: string[], key: string) {
  const selected = new Set(selectedResourceKeys)

  if (selected.has(key)) {
    selected.delete(key)
  } else {
    selected.add(key)
  }

  return [...selected].sort((left, right) => left.localeCompare(right))
}

interface ResourceMultiSelectProps {
  disabled?: boolean
  resources: SetupResource[]
  selectedResourceKeys: string[]
  onSelectedResourceKeysChange: (selectedResourceKeys: string[]) => void
}

function ResourceMultiSelect({
  disabled = false,
  onSelectedResourceKeysChange,
  resources,
  selectedResourceKeys,
}: ResourceMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const selectedSet = useMemo(
    () => new Set(selectedResourceKeys),
    [selectedResourceKeys],
  )
  const filteredResources = useMemo(
    () => filterResources(resources, search),
    [resources, search],
  )
  const summary = getResourceSummary(resources, selectedResourceKeys)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            className="w-full justify-between overflow-hidden"
            disabled={disabled}
            type="button"
            variant="outline"
          />
        }
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            selectedResourceKeys.length === 0 && "text-muted-foreground",
          )}
        >
          {summary}
        </span>
        <CaretDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(34rem,var(--available-width))] gap-0 overflow-hidden p-0"
        sideOffset={6}
      >
        <Command shouldFilter={false}>
          <CommandInput
            aria-label="Search PostHog projects"
            onValueChange={setSearch}
            placeholder="Search projects..."
            value={search}
          />
          <CommandList className="max-h-72">
            <CommandEmpty>No projects found.</CommandEmpty>
            <CommandGroup>
              {filteredResources.map((resource) => {
                const selected = selectedSet.has(resource.key)

                return (
                  <CommandItem
                    data-checked={selected}
                    key={resource.key}
                    onSelect={() =>
                      onSelectedResourceKeysChange(
                        toggleResourceSelection(
                          selectedResourceKeys,
                          resource.key,
                        ),
                      )
                    }
                    value={`${resource.label} ${resource.id} ${resource.key}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap">
                      <Checkbox checked={selected} tabIndex={-1} />
                      <span className="min-w-0 flex-1 truncate">
                        {resource.label}
                      </span>
                      <code className="shrink-0 text-xs text-muted-foreground">
                        {resource.type} · {resource.id}
                      </code>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
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
  const groupedCapabilities = useMemo(
    () => getGroupedCapabilities(discovery?.capabilityRecommendations ?? []),
    [discovery],
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

  function handleSelectedResourceKeysChange(next: string[]) {
    setSelectedResourceKeys(next)

    if (!next.includes(defaultResourceKey)) {
      setDefaultResourceKey(next[0] ?? "")
    }
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
                {credentialHelpUrl ? (
                  <>
                    {" "}
                    Create or review keys in{" "}
                    <a
                      className="underline underline-offset-3 hover:text-foreground"
                      href={credentialHelpUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      PostHog user API key settings
                    </a>
                    .
                  </>
                ) : null}
              </SettingsRowDescription>
            </SettingsRowLabel>
            <div className="flex w-full max-w-sm flex-col gap-3">
              <Input
                onChange={(event) => {
                  setApiKey(event.target.value)
                  setDiscovery(null)
                }}
                placeholder={setup.credential.placeholder}
                type="text"
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
                <div className="w-full max-w-sm">
                  {discovery.resources.length > 0 ? (
                    <ResourceMultiSelect
                      resources={discovery.resources}
                      selectedResourceKeys={selectedResourceKeys}
                      onSelectedResourceKeysChange={
                        handleSelectedResourceKeysChange
                      }
                    />
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
              <div className="flex flex-col gap-5 p-4">
                {groupedCapabilities.map((group) => (
                  <div className="flex flex-col gap-2" key={group.groupKey}>
                    <h3 className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {group.label}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {group.entries.map((capability) => (
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
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                {capability.label}
                              </span>
                              <Badge
                                className="shrink-0"
                                variant={getCapabilityBadgeVariant(
                                  capability.status,
                                )}
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
                  </div>
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

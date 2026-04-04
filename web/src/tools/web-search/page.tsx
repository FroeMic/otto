"use client";

import Image from "next/image";
import {
  type ReadonlyURLSearchParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useMemo } from "react";

import {
  SettingsCard,
  SettingsPage,
  SettingsPageTitle,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  WebSearchProvider,
  WebSearchRuntimeConfig,
} from "@/lib/web-search-config";
import type {
  AgentCapability,
  AgentCapabilityDirection,
  ToolSurfacePageProps,
} from "@/tools/types";

const capabilityDirectionConfig: Record<
  AgentCapabilityDirection,
  { label: string; order: number }
> = {
  trigger: { label: "Session triggers", order: 0 },
  tool: { label: "Tools", order: 1 },
  read: { label: "Read access", order: 2 },
};

type ConfigRow = {
  description?: string;
  title: string;
  value: string;
};

function groupCapabilities(capabilities: AgentCapability[]) {
  const groups = new Map<AgentCapabilityDirection, AgentCapability[]>();

  for (const capability of capabilities) {
    const currentGroup = groups.get(capability.direction) ?? [];
    currentGroup.push(capability);
    groups.set(capability.direction, currentGroup);
  }

  return [...groups.entries()].sort(
    ([left], [right]) =>
      capabilityDirectionConfig[left].order -
      capabilityDirectionConfig[right].order,
  );
}

function updateQueryString(
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  updates: Record<string, string | null>,
) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      params.delete(key);
      continue;
    }

    params.set(key, value);
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

function formatProviderLabel(provider: WebSearchProvider | null | undefined) {
  switch (provider) {
    case "brave":
      return "Brave";
    case "gemini":
      return "Gemini";
    case "grok":
      return "Grok";
    case "kimi":
      return "Kimi";
    case "perplexity":
      return "Perplexity";
    default:
      return "Not configured";
  }
}

function formatManagedByLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  if (value === "control_plane_env") {
    return "Workspace defaults";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAvailabilityLabel(
  availability: "available" | "blocked" | undefined,
) {
  return availability === "available" ? "Available" : "Unavailable";
}

function buildDefaultRows(config: WebSearchRuntimeConfig): ConfigRow[] {
  return [
    {
      title: "Default results",
      value:
        config.maxResults !== undefined
          ? String(config.maxResults)
          : "Workspace default",
    },
    {
      title: "Timeout",
      value:
        config.timeoutSeconds !== undefined
          ? `${config.timeoutSeconds}s`
          : "Workspace default",
    },
    {
      title: "Cache TTL",
      value:
        config.cacheTtlMinutes !== undefined
          ? `${config.cacheTtlMinutes} min`
          : "Workspace default",
    },
  ];
}

function buildProviderRows(config: WebSearchRuntimeConfig): ConfigRow[] {
  const rows: ConfigRow[] = [
    {
      description: "The workspace keeps the provider API key in this env var.",
      title: "API key env var",
      value: config.credentialEnvVar ?? "Not exposed",
    },
  ];

  if (config.provider === "brave" || config.braveMode) {
    rows.push({
      title: "Brave mode",
      value: config.braveMode ?? "Workspace default",
    });
  }

  if (config.provider === "gemini" || config.geminiModel) {
    rows.push({
      title: "Gemini model",
      value: config.geminiModel ?? "Workspace default",
    });
  }

  if (
    config.provider === "grok" ||
    config.grokModel ||
    config.grokInlineCitations !== undefined
  ) {
    rows.push({
      title: "Grok model",
      value: config.grokModel ?? "Workspace default",
    });
    rows.push({
      title: "Grok inline citations",
      value: config.grokInlineCitations ? "Enabled" : "Disabled",
    });
  }

  if (config.provider === "kimi" || config.kimiModel || config.kimiBaseUrl) {
    rows.push({
      title: "Kimi model",
      value: config.kimiModel ?? "Workspace default",
    });
    rows.push({
      title: "Kimi base URL",
      value: config.kimiBaseUrl ?? "Workspace default",
    });
  }

  if (
    config.provider === "perplexity" ||
    config.perplexityModel ||
    config.perplexityBaseUrl
  ) {
    rows.push({
      title: "Perplexity model",
      value: config.perplexityModel ?? "Workspace default",
    });
    rows.push({
      title: "Perplexity base URL",
      value: config.perplexityBaseUrl ?? "Workspace default",
    });
  }

  return rows;
}

export function WebSearchToolPage({
  surface,
}: ToolSurfacePageProps<WebSearchRuntimeConfig>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const currentTab: "capabilities" | "status" | "configuration" =
    tabParam === "status" ||
    tabParam === "capabilities" ||
    tabParam === "configuration"
      ? tabParam
      : "capabilities";

  const hasStatusIssue =
    surface.availability !== "available" || Boolean(surface.blockingReason);
  const capabilityGroups = useMemo(
    () => groupCapabilities(surface.agentCapabilities ?? []),
    [surface.agentCapabilities],
  );
  const defaultRows = useMemo(
    () => buildDefaultRows(surface.config),
    [surface.config],
  );
  const providerRows = useMemo(
    () => buildProviderRows(surface.config),
    [surface.config],
  );

  function setTopLevelTab(value: "capabilities" | "status" | "configuration") {
    router.replace(
      updateQueryString(pathname, searchParams, {
        tab: value,
      }),
      { scroll: false },
    );
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 pb-12">
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Image
            alt=""
            className="size-8"
            height={32}
            src="/integrations/web-search.svg"
            width={32}
          />
          <SettingsPageTitle>{surface.label}</SettingsPageTitle>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {surface.description}
        </p>
      </section>

      <Tabs
        className="flex flex-col gap-6"
        onValueChange={(value) =>
          setTopLevelTab(value as "capabilities" | "status" | "configuration")
        }
        value={currentTab}
      >
        <TabsList className="h-auto justify-start overflow-x-auto p-1">
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="status">
            <span>Status</span>
            {hasStatusIssue ? (
              <span className="size-2 rounded-full bg-destructive" />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="capabilities">
          <SettingsPage className="mx-0 max-w-none">
            <div className="flex flex-col gap-8">
              {capabilityGroups.length > 0 ? (
                capabilityGroups.map(([direction, capabilities]) => (
                  <div className="flex flex-col gap-3" key={direction}>
                    <SettingsSectionTitle>
                      {capabilityDirectionConfig[direction].label}
                    </SettingsSectionTitle>
                    <SettingsCard>
                      {capabilities.map((capability) => (
                        <SettingsRow key={capability.key}>
                          <SettingsRowLabel>
                            <SettingsRowTitle>
                              {capability.label}
                            </SettingsRowTitle>
                            <SettingsRowDescription>
                              {capability.description}
                            </SettingsRowDescription>
                            {capability.conditionNote ? (
                              <span className="text-xs text-muted-foreground">
                                {capability.conditionNote}
                              </span>
                            ) : null}
                          </SettingsRowLabel>
                          <Badge variant="outline">
                            {capabilityDirectionConfig[direction].label}
                          </Badge>
                        </SettingsRow>
                      ))}
                    </SettingsCard>
                  </div>
                ))
              ) : (
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>
                        No capabilities listed
                      </SettingsRowTitle>
                      <SettingsRowDescription>
                        Otto has no web-search-specific capabilities to show
                        yet.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                  </SettingsRow>
                </SettingsCard>
              )}
            </div>
          </SettingsPage>
        </TabsContent>

        <TabsContent value="status">
          <SettingsPage className="mx-0 max-w-none">
            <div className="flex flex-col gap-8">
              {surface.blockingReason ? (
                <Alert variant="destructive">
                  <AlertTitle>Web search is unavailable</AlertTitle>
                  <AlertDescription>{surface.blockingReason}</AlertDescription>
                </Alert>
              ) : null}

              <SettingsSection>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Status</SettingsRowTitle>
                      <SettingsRowDescription>
                        Otto can only use web search when a provider is
                        configured.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Badge
                      variant={
                        surface.availability === "available"
                          ? "outline"
                          : "destructive"
                      }
                    >
                      {formatAvailabilityLabel(surface.availability)}
                    </Badge>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Provider</SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {formatProviderLabel(surface.config.provider)}
                    </span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>
                        Workspace configuration source
                      </SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {formatManagedByLabel(surface.config.managedBy)}
                    </span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Workspace edits</SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {surface.canUserEdit ? "Allowed" : "Not allowed here"}
                    </span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Otto edits</SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {surface.canAgentEdit ? "Allowed" : "Not allowed here"}
                    </span>
                  </SettingsRow>
                </SettingsCard>
              </SettingsSection>
            </div>
          </SettingsPage>
        </TabsContent>

        <TabsContent value="configuration">
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
                      {formatProviderLabel(surface.config.provider)}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

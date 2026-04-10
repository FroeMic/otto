"use client";

import Image from "next/image";
import {
  type ReadonlyURLSearchParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

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
} from "../../../../../app/[orgSlug]/settings/_components/settings-layout";
import { Alert, AlertDescription, AlertTitle } from "../../../../../components/ui/alert";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Checkbox } from "../../../../../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../components/ui/select";
import { Switch } from "../../../../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../components/ui/tabs";
import { Textarea } from "../../../../../components/ui/textarea";
import type {
  AgentCapability,
  AgentCapabilityDirection,
} from "../../../../../lib/agent-capabilities";
import { getWhatsAppUiPhase } from "../../../../../lib/workspace";
import { deriveWhatsAppPolicyEffects } from "../../../../../tools/whatsapp/policy";

type WhatsAppTab = "capabilities" | "status" | "configuration";

type WhatsAppRuntimeConfig = {
  ackReactionEnabled: boolean;
  allowedGroupIds: string[];
  allowedNumbers: string[];
  dmPolicy: "pairing" | "allowlist" | "disabled";
  enabled: boolean;
  entryVersion: number;
  groupAllowedNumbers: string[];
  groupPolicy: "disabled" | "allowlist";
  installState: "installed" | "uninstalled";
  requireMentionInGroups: boolean;
  schemaVersion: string;
};

type WhatsAppRuntimeConfigSurface = {
  config: WhatsAppRuntimeConfig;
  derivedEffects?: {
    warnings?: string[];
    wouldFullyLockOutWhatsApp?: boolean;
  };
  description: string;
  key: string;
  kind: string;
  label: string;
};

type WhatsAppLinkSession = {
  completedAt: string | Date | null;
  createdAt: string | Date;
  expiresAt: string | Date | null;
  forceRelink: boolean;
  id: string;
  lastError: string | null;
  qrDataUrl: string | null;
  status: string;
  updatedAt: string | Date;
};

type WhatsAppIntegrationSummary = {
  connectedAt: string | Date | null;
  lastError: string | null;
  lastErrorAt: string | Date | null;
  selfE164: string | null;
  status: string;
} | null;

type Props = {
  agentCapabilities: AgentCapability[];
  connectedAtLabel: string | null;
  initialIntegration: WhatsAppIntegrationSummary;
  initialLinkSession: WhatsAppLinkSession | null;
  initialSurface: WhatsAppRuntimeConfigSurface | null;
  orgSlug: string;
  runtimeApplyIsActive: boolean;
  runtimeApplyStatusLabel: string | null;
  runtimeStatusLabel: string;
  statusAlert: {
    description: string;
    title: string;
    variant: "default" | "destructive";
  } | null;
  tabNavigationMode?: "query_param" | "section_path";
  tabOverride?: WhatsAppTab;
  whatsappPhaseLabel: string;
  whatsappStatusVariant: "default" | "destructive" | "outline" | "secondary";
};

const capabilityDirectionConfig: Record<
  AgentCapabilityDirection,
  { label: string; order: number }
> = {
  trigger: { label: "Session triggers", order: 0 },
  tool: { label: "Tools", order: 1 },
  read: { label: "Read access", order: 2 },
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

function joinList(values: string[]) {
  return values.join("\n");
}

function parseListInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatExpiresIn(
  expiresAt: string | Date | null,
  currentTimestamp: number,
) {
  if (!expiresAt) {
    return null;
  }

  const expiresAtDate = new Date(expiresAt);
  const remainingMs = expiresAtDate.getTime() - currentTimestamp;

  if (Number.isNaN(expiresAtDate.getTime()) || remainingMs <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function requestBody(config: WhatsAppRuntimeConfig) {
  return {
    ackReactionEnabled: config.ackReactionEnabled,
    allowedGroupIds: config.allowedGroupIds,
    allowedNumbers: config.allowedNumbers,
    dmPolicy: config.dmPolicy,
    groupAllowedNumbers: config.groupAllowedNumbers,
    groupPolicy: config.groupPolicy,
    requireMentionInGroups: config.requireMentionInGroups,
  };
}

function getDmPolicyLabel(value: WhatsAppRuntimeConfig["dmPolicy"]) {
  switch (value) {
    case "pairing":
      return "Any new contact";
    case "allowlist":
      return "Only selected numbers";
    case "disabled":
      return "Disabled";
  }
}

function getGroupPolicyLabel(value: WhatsAppRuntimeConfig["groupPolicy"]) {
  switch (value) {
    case "allowlist":
      return "Only selected groups";
    case "disabled":
      return "Disabled";
  }
}

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
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

function SaveBar(props: {
  hasChanges: boolean;
  isPending: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  const { hasChanges, isPending, onReset, onSave } = props;

  return (
    <div className="fixed right-6 bottom-6 left-6 z-30 sm:left-[max(1.5rem,calc(50%-24rem))] sm:right-auto sm:w-[min(100%-3rem,48rem)]">
      <div className="flex flex-col gap-3 rounded-2xl border bg-background/95 p-4 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/85 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            You have unsaved WhatsApp changes.
          </p>
          <p className="text-xs text-muted-foreground">
            Review the changes, then save or discard them.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            disabled={isPending || !hasChanges}
            onClick={onReset}
            type="button"
            variant="outline"
          >
            Discard
          </Button>
          <Button
            disabled={isPending || !hasChanges}
            onClick={onSave}
            type="button"
          >
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppIntegrationPanel(props: Props) {
  const { initialIntegration, initialLinkSession, initialSurface, orgSlug } =
    props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [prepConfirmed, setPrepConfirmed] = useState(false);
  const [integration, setIntegration] =
    useState<WhatsAppIntegrationSummary>(initialIntegration);
  const [surface, setSurface] = useState<WhatsAppRuntimeConfigSurface | null>(
    initialSurface,
  );
  const [linkSession, setLinkSession] = useState<WhatsAppLinkSession | null>(
    initialLinkSession,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [pendingActivationSessionId, setPendingActivationSessionId] = useState<
    string | null
  >(null);
  const [draftConfig, setDraftConfig] = useState<WhatsAppRuntimeConfig | null>(
    initialSurface?.config ?? null,
  );
  const [allowedNumbersInput, setAllowedNumbersInput] = useState(
    joinList(initialSurface?.config.allowedNumbers ?? []),
  );
  const [allowedGroupIdsInput, setAllowedGroupIdsInput] = useState(
    joinList(initialSurface?.config.allowedGroupIds ?? []),
  );
  const [groupAllowedNumbersInput, setGroupAllowedNumbersInput] = useState(
    joinList(initialSurface?.config.groupAllowedNumbers ?? []),
  );

  const uiPhase = useMemo(
    () =>
      getWhatsAppUiPhase({
        integrationStatus: integration?.status ?? null,
        linkSessionStatus: linkSession?.status ?? null,
      }),
    [integration?.status, linkSession?.status],
  );
  const integrationStatus = integration?.status ?? null;
  const hasPairedNumber =
    uiPhase === "activating" ||
    Boolean(integration?.connectedAt) ||
    Boolean(integration?.selfE164);
  const canConfigure = hasPairedNumber;
  const tabParam = searchParams.get("tab");
  const queryTab: WhatsAppTab =
    tabParam === "capabilities" || tabParam === "status"
      ? tabParam
      : tabParam === "configuration"
        ? canConfigure
          ? "configuration"
          : "status"
        : "capabilities";
  const currentTab =
    props.tabNavigationMode === "section_path" && props.tabOverride
      ? props.tabOverride === "configuration" && !canConfigure
        ? "status"
        : props.tabOverride
      : queryTab;
  const hasStatusIssue = Boolean(props.statusAlert);

  useEffect(() => {
    setIntegration(initialIntegration);
  }, [initialIntegration]);

  useEffect(() => {
    setSurface(initialSurface);
    setDraftConfig(initialSurface?.config ?? null);
    setAllowedNumbersInput(
      joinList(initialSurface?.config.allowedNumbers ?? []),
    );
    setAllowedGroupIdsInput(
      joinList(initialSurface?.config.allowedGroupIds ?? []),
    );
    setGroupAllowedNumbersInput(
      joinList(initialSurface?.config.groupAllowedNumbers ?? []),
    );
  }, [initialSurface]);

  useEffect(() => {
    setLinkSession(initialLinkSession);
  }, [initialLinkSession]);

  useEffect(() => {
    if (!linkSession) {
      return;
    }

    if (
      linkSession.status !== "queued" &&
      linkSession.status !== "starting" &&
      linkSession.status !== "qr_ready" &&
      !(
        linkSession.status === "connected" &&
        pendingActivationSessionId === linkSession.id &&
        integrationStatus !== "connected" &&
        integrationStatus !== "apply_failed" &&
        integrationStatus !== "link_failed"
      )
    ) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const response = await fetch(
        `/api/integrations/${orgSlug}/whatsapp/link-sessions/current`,
        {
          cache: "no-store",
          method: "GET",
        },
      );
      const data = await readJson(response);

      if (!response.ok) {
        return;
      }

      const nextLinkSession =
        (data?.linkSession as WhatsAppLinkSession | null | undefined) ?? null;
      setLinkSession(nextLinkSession);

      if (
        nextLinkSession?.status === "connected" &&
        nextLinkSession.id === pendingActivationSessionId &&
        integrationStatus !== null &&
        integrationStatus !== "connected" &&
        integrationStatus !== "apply_failed" &&
        integrationStatus !== "link_failed"
      ) {
        setIntegration((currentIntegration) =>
          currentIntegration
            ? {
                ...currentIntegration,
                status: "activating",
              }
            : currentIntegration,
        );
      }

      if (nextLinkSession?.status === "failed") {
        setPendingActivationSessionId(null);
        router.refresh();
      }
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    integrationStatus,
    linkSession,
    orgSlug,
    pendingActivationSessionId,
    router,
  ]);

  useEffect(() => {
    if (uiPhase !== "activating") {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [router, uiPhase]);

  function buildTabHref(value: WhatsAppTab) {
    if (props.tabNavigationMode === "section_path") {
      return `/${orgSlug}/integrations2/whatsapp/${value}`;
    }

    return updateQueryString(pathname, searchParams, {
      tab: value,
    });
  }

  useEffect(() => {
    if (currentTab !== "configuration" || canConfigure) {
      return;
    }

    const nextHref =
      props.tabNavigationMode === "section_path"
        ? `/${orgSlug}/integrations2/whatsapp/status`
        : updateQueryString(pathname, searchParams, {
            tab: "status",
          });

    router.replace(nextHref, { scroll: false });
  }, [
    canConfigure,
    currentTab,
    orgSlug,
    pathname,
    props.tabNavigationMode,
    router,
    searchParams,
  ]);

  useEffect(() => {
    if (linkSession?.status !== "qr_ready") {
      setCurrentTimestamp(Date.now());
      return;
    }

    setCurrentTimestamp(Date.now());

    const intervalId = window.setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [linkSession?.status]);

  const currentConfig = useMemo(() => {
    if (!draftConfig) {
      return null;
    }

    return {
      ...draftConfig,
      allowedGroupIds: parseListInput(allowedGroupIdsInput),
      allowedNumbers: parseListInput(allowedNumbersInput),
      groupAllowedNumbers: parseListInput(groupAllowedNumbersInput),
    };
  }, [
    allowedGroupIdsInput,
    allowedNumbersInput,
    draftConfig,
    groupAllowedNumbersInput,
  ]);

  const derivedEffects = useMemo(() => {
    if (!currentConfig || !surface) {
      return null;
    }

    return deriveWhatsAppPolicyEffects({
      config: requestBody(currentConfig),
      currentConfig: surface.config,
    });
  }, [currentConfig, surface]);

  const hasUnsavedChanges = useMemo(() => {
    if (!currentConfig || !surface) {
      return false;
    }

    return (
      JSON.stringify(requestBody(currentConfig)) !==
      JSON.stringify(requestBody(surface.config))
    );
  }, [currentConfig, surface]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (
        anchor.target === "_blank" ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const currentUrl = new URL(window.location.href);
      const nextUrl = new URL(anchor.href, window.location.href);

      if (
        currentUrl.pathname === nextUrl.pathname &&
        currentUrl.search === nextUrl.search &&
        currentUrl.hash === nextUrl.hash
      ) {
        return;
      }

      if (
        window.confirm(
          "You have unsaved WhatsApp changes. Leave this page without saving?",
        )
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedChanges]);

  const qrExpiresIn = useMemo(
    () => formatExpiresIn(linkSession?.expiresAt ?? null, currentTimestamp),
    [currentTimestamp, linkSession?.expiresAt],
  );
  const isWhatsAppInstalled = surface?.config.installState === "installed";
  const linkedNumber = integration?.selfE164 ?? "No number connected yet";

  function setTopLevelTab(value: WhatsAppTab) {
    router.replace(buildTabHref(value), { scroll: false });
  }

  async function runAction<T>(operation: () => Promise<T>) {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      return await operation();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "WhatsApp request failed";
      setErrorMessage(message);
      return null;
    }
  }

  async function postJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(
        typeof data?.message === "string" ? data.message : "Request failed",
      );
    }

    return data;
  }

  async function patchJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(
        typeof data?.message === "string" ? data.message : "Request failed",
      );
    }

    return data;
  }

  function resetConfigDraft() {
    setDraftConfig(surface?.config ?? null);
    setAllowedNumbersInput(joinList(surface?.config.allowedNumbers ?? []));
    setAllowedGroupIdsInput(joinList(surface?.config.allowedGroupIds ?? []));
    setGroupAllowedNumbersInput(
      joinList(surface?.config.groupAllowedNumbers ?? []),
    );
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleGenerateQr(forceRelink: boolean) {
    startTransition(() => {
      void runAction(async () => {
        const data = await postJson(
          `/api/integrations/${orgSlug}/whatsapp/link-sessions`,
          {
            forceRelink,
          },
        );
        const nextLinkSession =
          (data?.linkSession as WhatsAppLinkSession | null | undefined) ?? null;
        setLinkSession(nextLinkSession);
        setPendingActivationSessionId(nextLinkSession?.id ?? null);
        setSuccessMessage(
          forceRelink
            ? "A new WhatsApp QR session has started."
            : "WhatsApp QR generation started. Otto will activate WhatsApp after pairing succeeds.",
        );
        setTopLevelTab("status");
        router.refresh();
      });
    });
  }

  function handleClearCurrentQr() {
    startTransition(() => {
      void runAction(async () => {
        const data = await postJson(
          `/api/integrations/${orgSlug}/whatsapp/link-sessions/clear`,
          {},
        );
        setLinkSession(
          (data?.linkSession as WhatsAppLinkSession | null | undefined) ?? null,
        );
        setPendingActivationSessionId(null);
        setSuccessMessage("The current WhatsApp QR session has been cleared.");
        router.refresh();
      });
    });
  }

  function handleSaveConfig() {
    if (!currentConfig || !surface) {
      return;
    }

    if (
      derivedEffects?.wouldFullyLockOutWhatsApp &&
      !window.confirm(
        "This change would fully lock Otto out of WhatsApp. Do you want to save it anyway?",
      )
    ) {
      return;
    }

    startTransition(() => {
      void runAction(async () => {
        const data = await patchJson(
          `/api/runtime-config/${orgSlug}/surfaces/channel/whatsapp`,
          {
            allowDestructiveChanges: Boolean(
              derivedEffects?.wouldFullyLockOutWhatsApp,
            ),
            expectedEntryVersion: surface.config.entryVersion,
            patch: requestBody(currentConfig),
            summary: "Updated WhatsApp settings",
          },
        );
        const nextSurface =
          (data?.surface as WhatsAppRuntimeConfigSurface | null | undefined) ??
          null;
        setSurface(nextSurface);
        setDraftConfig(nextSurface?.config ?? null);
        setSuccessMessage("WhatsApp settings saved.");
        router.refresh();
      });
    });
  }

  function handleReapply() {
    startTransition(() => {
      void runAction(async () => {
        await postJson(
          `/api/runtime-config/${orgSlug}/surfaces/channel/whatsapp/reapply`,
          {
            summary: "Reapplied WhatsApp settings",
          },
        );
        setSuccessMessage("Otto is reapplying WhatsApp settings.");
        router.refresh();
      });
    });
  }

  function handleDisconnect() {
    if (
      !window.confirm(
        "Unlink the current WhatsApp number from Otto? Saved settings will stay in place so you can pair a number again later.",
      )
    ) {
      return;
    }

    startTransition(() => {
      void runAction(async () => {
        await postJson(`/api/integrations/${orgSlug}/whatsapp/disconnect`, {});
        setSuccessMessage("WhatsApp disconnect has been queued.");
        router.refresh();
      });
    });
  }

  function handleDisable() {
    if (
      !window.confirm(
        "Remove WhatsApp from this workspace? This clears the saved WhatsApp session on the tenant server and removes WhatsApp from the tenant runtime.",
      )
    ) {
      return;
    }

    startTransition(() => {
      void runAction(async () => {
        const data = await postJson(
          `/api/integrations/${orgSlug}/whatsapp/disable`,
          {},
        );
        setLinkSession(
          (data?.linkSession as WhatsAppLinkSession | null | undefined) ?? null,
        );
        setSurface(
          (data?.surface as WhatsAppRuntimeConfigSurface | null | undefined) ??
            null,
        );
        setDraftConfig(
          ((data?.surface as WhatsAppRuntimeConfigSurface | null | undefined)
            ?.config as WhatsAppRuntimeConfig | undefined) ?? null,
        );
        setPendingActivationSessionId(null);
        setSuccessMessage(
          "WhatsApp disable has been queued. Otto will remove the runtime config and clear the saved WhatsApp session.",
        );
        router.refresh();
      });
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert>
          <AlertTitle>Updated</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs
        className="flex flex-col gap-6"
        value={currentTab}
        onValueChange={(value) => setTopLevelTab(value as WhatsAppTab)}
      >
        <TabsList className="h-auto justify-start overflow-x-auto p-1">
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="status">
            <span>Status</span>
            {hasStatusIssue ? (
              <span className="size-2 rounded-full bg-destructive" />
            ) : null}
          </TabsTrigger>
          <TabsTrigger disabled={!canConfigure} value="configuration">
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="capabilities">
          <SettingsPage className="mx-0 max-w-none">
            <div className="flex flex-col gap-8">
              {props.agentCapabilities.length > 0 ? (
                groupCapabilities(props.agentCapabilities).map(
                  ([direction, capabilities]) => (
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
                  ),
                )
              ) : (
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>
                        No capabilities listed
                      </SettingsRowTitle>
                      <SettingsRowDescription>
                        Otto has no WhatsApp-specific capabilities to show yet.
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
              {props.statusAlert ? (
                <Alert variant={props.statusAlert.variant}>
                  <AlertTitle>{props.statusAlert.title}</AlertTitle>
                  <AlertDescription>
                    {props.statusAlert.description}
                  </AlertDescription>
                </Alert>
              ) : null}

              {hasPairedNumber ? (
                <SettingsSection>
                  <SettingsSectionTitle>Status</SettingsSectionTitle>
                  <SettingsSectionDescription>
                    Current WhatsApp connection details for this workspace.
                  </SettingsSectionDescription>
                  <SettingsCard>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Status</SettingsRowTitle>
                        <SettingsRowDescription>
                          WhatsApp pairing and runtime activation state.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <Badge variant={props.whatsappStatusVariant}>
                        {props.whatsappPhaseLabel}
                      </Badge>
                    </SettingsRow>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Dedicated number</SettingsRowTitle>
                      </SettingsRowLabel>
                      <span className="text-sm text-muted-foreground">
                        {linkedNumber}
                      </span>
                    </SettingsRow>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Connected on</SettingsRowTitle>
                      </SettingsRowLabel>
                      <span className="text-sm text-muted-foreground">
                        {props.connectedAtLabel ?? "Not connected yet"}
                      </span>
                    </SettingsRow>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Otto status</SettingsRowTitle>
                      </SettingsRowLabel>
                      <span className="text-sm text-muted-foreground">
                        {props.runtimeStatusLabel}
                      </span>
                    </SettingsRow>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Last update</SettingsRowTitle>
                      </SettingsRowLabel>
                      <span className="text-sm text-muted-foreground">
                        {props.runtimeApplyStatusLabel ?? "No recent update"}
                      </span>
                    </SettingsRow>
                  </SettingsCard>
                </SettingsSection>
              ) : null}

              {uiPhase === "prepare" ? (
                <SettingsSection>
                  <SettingsSectionTitle>Pair a number</SettingsSectionTitle>
                  <SettingsSectionDescription>
                    Prepare one dedicated WhatsApp Business number before you
                    pair it with Otto.
                  </SettingsSectionDescription>
                  <SettingsCard>
                    <SettingsRow className="flex-col items-start gap-4">
                      <SettingsRowLabel>
                        <SettingsRowTitle>Before you pair</SettingsRowTitle>
                        <SettingsRowDescription>
                          Use a dedicated number for Otto. Personal-number mode
                          is not supported in this version.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-foreground">
                        <li>Buy and activate a new dedicated phone number.</li>
                        <li>
                          Install WhatsApp Business and register that number on
                          your phone.
                        </li>
                        <li>
                          Finish the basic in-app setup, then come back here.
                        </li>
                        <li>
                          In WhatsApp Business, open Settings &gt; Linked
                          Devices &gt; Link a Device when you are ready to scan.
                        </li>
                      </ol>
                      <div className="flex items-start gap-3 rounded-2xl border p-3">
                        <Checkbox
                          checked={prepConfirmed}
                          id="whatsapp-prep-confirmed"
                          onCheckedChange={(checked) =>
                            setPrepConfirmed(Boolean(checked))
                          }
                        />
                        <label
                          className="text-sm leading-6 text-foreground"
                          htmlFor="whatsapp-prep-confirmed"
                        >
                          I have activated a dedicated number in WhatsApp
                          Business and I am ready to pair it with Otto.
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          disabled={
                            isPending ||
                            !prepConfirmed ||
                            props.runtimeApplyIsActive ||
                            integration?.status === "apply_failed"
                          }
                          onClick={() => handleGenerateQr(false)}
                          type="button"
                        >
                          Pair now
                        </Button>
                      </div>
                    </SettingsRow>
                  </SettingsCard>
                </SettingsSection>
              ) : null}

              {uiPhase === "pairing" ? (
                <SettingsSection>
                  <SettingsSectionTitle>Scan the QR code</SettingsSectionTitle>
                  <SettingsSectionDescription>
                    Open WhatsApp Business on your phone and link the device to
                    Otto.
                  </SettingsSectionDescription>
                  <SettingsCard>
                    <SettingsRow className="flex-col items-start gap-4">
                      <div className="flex w-full flex-wrap items-start justify-between gap-3">
                        <SettingsRowLabel>
                          <SettingsRowTitle>Link this device</SettingsRowTitle>
                          <SettingsRowDescription>
                            In WhatsApp Business, open Settings &gt; Linked
                            Devices &gt; Link a Device, then scan the QR code.
                          </SettingsRowDescription>
                        </SettingsRowLabel>
                        {qrExpiresIn ? (
                          <Badge variant="outline">
                            Expires in {qrExpiresIn}
                          </Badge>
                        ) : null}
                      </div>
                      {linkSession?.status === "qr_ready" &&
                      linkSession.qrDataUrl ? (
                        <Image
                          alt="WhatsApp QR code"
                          className="w-full max-w-sm border bg-white p-4"
                          src={linkSession.qrDataUrl}
                          unoptimized
                          height={320}
                          width={320}
                        />
                      ) : (
                        <Alert>
                          <AlertTitle>Preparing QR code</AlertTitle>
                          <AlertDescription>
                            Otto is starting a new WhatsApp pairing session.
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="flex flex-wrap gap-3">
                        <Button
                          disabled={isPending}
                          onClick={handleClearCurrentQr}
                          type="button"
                          variant="outline"
                        >
                          Clear current QR
                        </Button>
                      </div>
                    </SettingsRow>
                  </SettingsCard>
                </SettingsSection>
              ) : null}

              {uiPhase === "attention" ? (
                <SettingsSection>
                  <SettingsSectionTitle>Repair connection</SettingsSectionTitle>
                  <SettingsSectionDescription>
                    Pair the dedicated number again to restore WhatsApp access.
                  </SettingsSectionDescription>
                  <Alert variant="destructive">
                    <AlertTitle>Linking failed</AlertTitle>
                    <AlertDescription>
                      {linkSession?.lastError ??
                        integration?.lastError ??
                        "WhatsApp pairing did not complete."}
                    </AlertDescription>
                  </Alert>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={isPending || props.runtimeApplyIsActive}
                      onClick={() => handleGenerateQr(false)}
                      type="button"
                    >
                      Pair now
                    </Button>
                  </div>
                </SettingsSection>
              ) : null}

              {uiPhase === "activating" ? (
                <SettingsSection>
                  <SettingsSectionTitle>Finishing setup</SettingsSectionTitle>
                  <SettingsSectionDescription>
                    Pairing succeeded. Otto is now activating WhatsApp.
                  </SettingsSectionDescription>
                  <Alert>
                    <AlertTitle>Pairing complete</AlertTitle>
                    <AlertDescription>
                      Otto linked{" "}
                      {integration?.selfE164 ?? "the dedicated number"} and is
                      now activating WhatsApp in the runtime.
                    </AlertDescription>
                  </Alert>
                  {linkSession?.qrDataUrl ? (
                    <div className="relative w-full max-w-sm">
                      <Image
                        alt="WhatsApp QR code"
                        className="w-full border bg-white p-4 opacity-40"
                        src={linkSession.qrDataUrl}
                        unoptimized
                        height={320}
                        width={320}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                        <div className="rounded-2xl border bg-background px-4 py-3 text-center shadow-sm">
                          <p className="text-sm font-medium text-foreground">
                            Finishing setup...
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Otto is applying the WhatsApp runtime configuration.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Alert>
                      <AlertTitle>Activation in progress</AlertTitle>
                      <AlertDescription>
                        Otto is still activating WhatsApp in the runtime. This
                        page will refresh automatically when setup completes.
                      </AlertDescription>
                    </Alert>
                  )}
                </SettingsSection>
              ) : null}

              {uiPhase === "connected" ? (
                <SettingsSection>
                  <SettingsSectionTitle>Actions</SettingsSectionTitle>
                  <SettingsSectionDescription>
                    Manage the linked number and current WhatsApp setup.
                  </SettingsSectionDescription>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={isPending || props.runtimeApplyIsActive}
                      onClick={() => handleGenerateQr(true)}
                      type="button"
                    >
                      Pair a new QR
                    </Button>
                    <Button
                      disabled={isPending}
                      onClick={handleDisconnect}
                      type="button"
                      variant="outline"
                    >
                      Unlink current number
                    </Button>
                    {integration && isWhatsAppInstalled ? (
                      <Button
                        disabled={isPending || props.runtimeApplyIsActive}
                        onClick={handleDisable}
                        type="button"
                        variant="outline"
                      >
                        Remove WhatsApp
                      </Button>
                    ) : null}
                    {surface ? (
                      <Button
                        disabled={isPending || props.runtimeApplyIsActive}
                        onClick={handleReapply}
                        type="button"
                        variant="outline"
                      >
                        Reapply settings
                      </Button>
                    ) : null}
                  </div>
                </SettingsSection>
              ) : null}
            </div>
          </SettingsPage>
        </TabsContent>

        <TabsContent value="configuration">
          <SettingsPage className="mx-0 max-w-none">
            {!surface || !draftConfig || !currentConfig ? (
              <Alert>
                <AlertTitle>WhatsApp settings are not ready yet</AlertTitle>
                <AlertDescription>
                  Otto is still loading the saved WhatsApp policy for this
                  workspace.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-col gap-8">
                <SettingsSection>
                  <SettingsSectionTitle>Access</SettingsSectionTitle>
                  <SettingsSectionDescription>
                    Choose who can start WhatsApp conversations and which groups
                    Otto can join.
                  </SettingsSectionDescription>
                  <SettingsCard>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Direct messages</SettingsRowTitle>
                        <SettingsRowDescription>
                          Any new contact lets Otto learn new direct-message
                          contacts. Only selected numbers limits access to the
                          numbers below.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <Select
                        disabled={props.runtimeApplyIsActive}
                        onValueChange={(value) =>
                          setDraftConfig({
                            ...draftConfig,
                            dmPolicy:
                              value as WhatsAppRuntimeConfig["dmPolicy"],
                          })
                        }
                        value={draftConfig.dmPolicy}
                      >
                        <SelectTrigger className="w-[18rem]">
                          <SelectValue placeholder="Choose DM access" />
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectItem value="pairing">
                            {getDmPolicyLabel("pairing")}
                          </SelectItem>
                          <SelectItem value="allowlist">
                            {getDmPolicyLabel("allowlist")}
                          </SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsRow>

                    <SettingsRow className="flex-col items-start gap-4">
                      <SettingsRowLabel>
                        <SettingsRowTitle>Allowed numbers</SettingsRowTitle>
                        <SettingsRowDescription>
                          Access policy: Otto will reply only to the selected
                          numbers when direct messages are limited.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <div className="w-full max-w-xl">
                        <Textarea
                          disabled={props.runtimeApplyIsActive}
                          onChange={(event) =>
                            setAllowedNumbersInput(event.target.value)
                          }
                          placeholder="+43123456789"
                          rows={4}
                          value={allowedNumbersInput}
                        />
                      </div>
                    </SettingsRow>

                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Groups</SettingsRowTitle>
                        <SettingsRowDescription>
                          Choose whether Otto can reply in selected WhatsApp
                          groups.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <Select
                        disabled={props.runtimeApplyIsActive}
                        onValueChange={(value) =>
                          setDraftConfig({
                            ...draftConfig,
                            groupPolicy:
                              value as WhatsAppRuntimeConfig["groupPolicy"],
                          })
                        }
                        value={draftConfig.groupPolicy}
                      >
                        <SelectTrigger className="w-[18rem]">
                          <SelectValue placeholder="Choose group access" />
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectItem value="disabled">Disabled</SelectItem>
                          <SelectItem value="allowlist">
                            {getGroupPolicyLabel("allowlist")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsRow>

                    <SettingsRow className="flex-col items-start gap-4">
                      <SettingsRowLabel>
                        <SettingsRowTitle>Allowed group IDs</SettingsRowTitle>
                        <SettingsRowDescription>
                          Group policy: Otto will reply only in the group IDs
                          listed here. Use WhatsApp group IDs ending in
                          <code> @g.us</code>.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <div className="w-full max-w-xl">
                        <Textarea
                          disabled={props.runtimeApplyIsActive}
                          onChange={(event) =>
                            setAllowedGroupIdsInput(event.target.value)
                          }
                          placeholder="1234567890@g.us"
                          rows={4}
                          value={allowedGroupIdsInput}
                        />
                      </div>
                    </SettingsRow>

                    <SettingsRow className="flex-col items-start gap-4">
                      <SettingsRowLabel>
                        <SettingsRowTitle>
                          Allowed group sender numbers
                        </SettingsRowTitle>
                        <SettingsRowDescription>
                          Leave this empty to reuse the selected direct-message
                          numbers above.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <div className="w-full max-w-xl">
                        <Textarea
                          disabled={props.runtimeApplyIsActive}
                          onChange={(event) =>
                            setGroupAllowedNumbersInput(event.target.value)
                          }
                          placeholder="+43123456789"
                          rows={4}
                          value={groupAllowedNumbersInput}
                        />
                      </div>
                    </SettingsRow>
                  </SettingsCard>
                </SettingsSection>

                <SettingsSection>
                  <SettingsSectionTitle>Replies</SettingsSectionTitle>
                  <SettingsSectionDescription>
                    Choose how Otto behaves once a WhatsApp message is allowed
                    through.
                  </SettingsSectionDescription>
                  <SettingsCard>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>
                          Require mention in groups
                        </SettingsRowTitle>
                        <SettingsRowDescription>
                          When this is on, Otto only replies in allowlisted
                          groups after it is explicitly mentioned.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <Switch
                        checked={draftConfig.requireMentionInGroups}
                        disabled={props.runtimeApplyIsActive}
                        onCheckedChange={(checked) =>
                          setDraftConfig({
                            ...draftConfig,
                            requireMentionInGroups: checked,
                          })
                        }
                      />
                    </SettingsRow>
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>
                          Acknowledgement reaction
                        </SettingsRowTitle>
                        <SettingsRowDescription>
                          Add Otto&apos;s fixed acknowledgement reaction when it
                          sees an eligible WhatsApp message.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <Switch
                        checked={draftConfig.ackReactionEnabled}
                        disabled={props.runtimeApplyIsActive}
                        onCheckedChange={(checked) =>
                          setDraftConfig({
                            ...draftConfig,
                            ackReactionEnabled: checked,
                          })
                        }
                      />
                    </SettingsRow>
                  </SettingsCard>
                </SettingsSection>

                {derivedEffects?.warnings?.length ? (
                  <Alert
                    variant={
                      derivedEffects.wouldFullyLockOutWhatsApp
                        ? "destructive"
                        : "default"
                    }
                  >
                    <AlertTitle>
                      These changes will limit who can contact Otto
                    </AlertTitle>
                    <AlertDescription>
                      <div className="flex flex-col gap-2">
                        {derivedEffects.warnings.map((warning) => (
                          <p key={warning}>{warning}</p>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            )}
          </SettingsPage>
        </TabsContent>
      </Tabs>

      {hasUnsavedChanges ? (
        <SettingsPage className="mx-0 max-w-none">
          <SaveBar
            hasChanges={hasUnsavedChanges}
            isPending={isPending}
            onReset={resetConfigDraft}
            onSave={handleSaveConfig}
          />
        </SettingsPage>
      ) : null}
    </div>
  );
}

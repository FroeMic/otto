"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { CapabilityInventoryRow } from "@/app/[orgSlug]/(app)/capabilities2/_components/capability-inventory-table";
import { CapabilityInventoryTable } from "@/app/[orgSlug]/(app)/capabilities2/_components/capability-inventory-table";
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
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildIntegrationSectionPath } from "@/integrations/framework/routing";

import { LinearConnectButton } from "./connect-button";

type LinearIntegrationUiState =
  | "connected"
  | "disabled"
  | "disconnected"
  | "needs_attention";

type LinearIntegrationSummary = {
  connectedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  status: string | null;
};

type Props = {
  canConnect: boolean;
  capabilityRows: CapabilityInventoryRow[];
  connectActionLabel: string;
  connectUrl: string;
  currentSection: "capabilities" | "configuration" | "status";
  hasConfiguration: boolean;
  iconSrc: string | null;
  orgSlug: string;
  pageDescription: string;
  statusLabel: string;
  summary: LinearIntegrationSummary | null;
  uiState: LinearIntegrationUiState;
};

function getStatusBadgeVariant(state: LinearIntegrationUiState) {
  switch (state) {
    case "connected":
      return "outline" as const;
    case "needs_attention":
      return "destructive" as const;
    case "disabled":
    case "disconnected":
      return "secondary" as const;
  }
}

function getStatusAlert(input: {
  error: string | null;
  state: LinearIntegrationUiState;
}) {
  if (input.state === "needs_attention") {
    return {
      description:
        input.error ??
        "Reconnect Linear to restore access for Otto in this workspace.",
      title: "Linear needs attention",
      variant: "destructive" as const,
    };
  }

  if (input.state === "disconnected") {
    return {
      description:
        "Add Linear to let Otto search issues, review project context, and help prepare follow-up work.",
      title: "Connect Linear",
      variant: "default" as const,
    };
  }

  if (input.state === "disabled") {
    return {
      description:
        "Linear is available for this workspace, but it is not active right now.",
      title: "Linear is turned off",
      variant: "default" as const,
    };
  }

  return null;
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function LinearIntegrationPanel(props: Props) {
  const {
    canConnect,
    capabilityRows,
    connectActionLabel,
    connectUrl,
    currentSection,
    hasConfiguration,
    iconSrc,
    orgSlug,
    pageDescription,
    statusLabel,
    summary,
    uiState,
  } = props;
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const statusAlert = getStatusAlert({
    error: summary?.lastError ?? null,
    state: uiState,
  });

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

  async function runAction(action: () => Promise<void>) {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await action();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Linear request failed",
      );
    }
  }

  function handleDisconnect() {
    if (
      !window.confirm(
        "Disconnect Linear from this workspace? Otto will stop using it until you reconnect.",
      )
    ) {
      return;
    }

    startTransition(() => {
      void runAction(async () => {
        await postJson(`/api/integrations/${orgSlug}/linear/disconnect`, {});
        setSuccessMessage("Linear has been disconnected.");
        router.refresh();
      });
    });
  }

  function setTopLevelTab(value: "capabilities" | "status" | "configuration") {
    if (value === "configuration" && !hasConfiguration) {
      return;
    }

    router.replace(
      buildIntegrationSectionPath({
        integrationKey: "linear",
        orgSlug,
        section: value,
      }),
      { scroll: false },
    );
  }

  return (
    <div className="flex w-full max-w-none flex-col gap-6 pb-12">
      <section className="flex max-w-3xl flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Image
                alt=""
                className="size-8"
                height={32}
                src={iconSrc ?? "/integrations/web-search.svg"}
                width={32}
              />
              <h1 className="text-3xl font-semibold tracking-tight">Linear</h1>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {pageDescription}
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

      <Tabs onValueChange={setTopLevelTab} value={currentSection}>
        <TabsList>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          {hasConfiguration ? (
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="capabilities">
          <div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col">
            <CapabilityInventoryTable
              rows={capabilityRows}
              showSource={false}
            />
          </div>
        </TabsContent>

        <TabsContent value="status">
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
                    <span className="text-sm font-medium">{orgSlug}</span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Last connected</SettingsRowTitle>
                      <SettingsRowDescription>
                        The most recent successful connection time.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <span className="text-sm font-medium">
                      {summary?.connectedAt ?? "Not connected"}
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
                      {summary?.lastErrorAt ?? "No recent activity"}
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
                        Add Linear so Otto can search issues and help draft
                        follow-up work.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <LinearConnectButton
                      connectUrl={connectUrl}
                      disabled={!canConnect || isPending}
                      label={connectActionLabel}
                    />
                  </SettingsRow>
                  {uiState === "connected" || uiState === "needs_attention" ? (
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Disconnect Linear</SettingsRowTitle>
                        <SettingsRowDescription>
                          Remove the current Linear connection from this
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
        </TabsContent>

        {hasConfiguration ? <TabsContent value="configuration" /> : null}
      </Tabs>
    </div>
  );
}

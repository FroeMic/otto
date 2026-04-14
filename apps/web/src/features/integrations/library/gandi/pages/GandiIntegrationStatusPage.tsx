import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";

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
} from "@/client/app/app-shell/SettingsLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  disconnectWorkspaceIntegration,
  enableWorkspaceIntegration,
} from "@/features/integrations/api/integrations";
import { IntegrationCapabilitiesTable } from "@/features/integrations/components/IntegrationCapabilitiesTable";
import { IntegrationSettingsShell } from "@/features/integrations/components/IntegrationSettingsShell";
import type { WorkspaceIntegrationDetail } from "@/features/integrations/types";

export interface GandiIntegrationStatusPageProps {
  currentSection: string;
  detail: WorkspaceIntegrationDetail;
  onSectionChange: (section: string) => void;
  orgSlug: string;
}

function getStatusLabel(detail: WorkspaceIntegrationDetail) {
  if (detail.connection.status.needsAttention) {
    return "Needs attention";
  }

  if (detail.connection.status.connected) {
    return "Enabled";
  }

  return "Not enabled";
}

function getStatusVariant(detail: WorkspaceIntegrationDetail) {
  if (detail.connection.status.needsAttention) {
    return "destructive" as const;
  }

  if (detail.connection.status.connected) {
    return "outline" as const;
  }

  return "secondary" as const;
}

export function GandiIntegrationStatusPage({
  currentSection,
  detail,
  onSectionChange,
  orgSlug,
}: GandiIntegrationStatusPageProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ["workspace-integrations", orgSlug],
    });
    void queryClient.invalidateQueries({
      queryKey: ["workspace-integration-detail", orgSlug, detail.integration.key],
    });
  }

  function handleEnable() {
    startTransition(() => {
      void enableWorkspaceIntegration({
        integrationKey: detail.integration.key,
        orgSlug,
      })
        .then(() => {
          setErrorMessage(null);
          setSuccessMessage("Gandi has been enabled for this workspace.");
          invalidate();
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error ? error.message : "Gandi request failed",
          );
        });
    });
  }

  function handleDisable() {
    if (
      !window.confirm(
        "Disable Gandi for this workspace? Otto will stop using it for domain research until you enable it again.",
      )
    ) {
      return;
    }

    startTransition(() => {
      void disconnectWorkspaceIntegration({
        integrationKey: detail.integration.key,
        orgSlug,
      })
        .then(() => {
          setErrorMessage(null);
          setSuccessMessage("Gandi has been disabled for this workspace.");
          invalidate();
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error ? error.message : "Gandi request failed",
          );
        });
    });
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

      {!detail.connection.status.connected ? (
        <Alert>
          <AlertTitle>Enable Gandi</AlertTitle>
          <AlertDescription>
            Turn on Gandi for this workspace so Otto can evaluate startup names,
            compare domain options, and inspect domain metadata.
          </AlertDescription>
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
                  Control whether Otto can use Gandi in this workspace.
                </SettingsSectionDescription>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Status</SettingsRowTitle>
                      <SettingsRowDescription>
                        Whether Otto can currently use Gandi for startup-name and
                        domain research in this workspace.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Badge variant={getStatusVariant(detail)}>
                      {getStatusLabel(detail)}
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
                      <SettingsRowTitle>Enablement</SettingsRowTitle>
                      <SettingsRowDescription>
                        Otto uses the platform-managed Gandi connection when this
                        workspace turns the integration on.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Button
                      disabled={isPending}
                      onClick={
                        detail.connection.status.connected
                          ? handleDisable
                          : handleEnable
                      }
                      variant={
                        detail.connection.status.connected ? "outline" : "default"
                      }
                    >
                      {detail.connection.status.connected
                        ? isPending
                          ? "Disabling..."
                          : "Disable Gandi"
                        : isPending
                          ? "Enabling..."
                          : "Enable Gandi"}
                    </Button>
                  </SettingsRow>
                </SettingsCard>
              </SettingsSection>
            </div>
          </SettingsPage>
        }
      />
    </div>
  );
}

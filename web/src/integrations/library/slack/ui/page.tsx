import Image from "next/image";
import { redirect } from "next/navigation";
import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import type { CapabilityInventoryRow } from "@/app/[orgSlug]/(app)/capabilities2/_components/capability-inventory-table";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getTenantManagedIntegrationSummary,
  getTenantSlackRuntimeConfigSurface,
  listManagedIntegrationCapabilitiesForOrganization,
  refreshTenantSlackDirectory,
} from "@/db/control-plane";
import { getIntegrationDefinition } from "@/integrations/framework";
import { buildIntegrationSectionPath } from "@/integrations/framework/routing";
import { hasSlackOAuthConfig } from "@/lib/env";
import {
  getCurrentOnboardingSession,
  getRuntimeApplyStatusLabel,
  getRuntimeStatusLabel,
  getSlackStatusLabel,
} from "@/lib/workspace";

import { buildSlackWorkspaceOauthStartUrl } from "../oauth-url";
import { SlackActionsMenu } from "./components/actions-menu";
import { SlackIntegrationPanel } from "./components/integration-panel";

type SlackStatusVariant = "default" | "destructive" | "outline" | "secondary";

function getStatusBadgeVariant(props: {
  effectiveSlackError: string | null;
  runtimeApplyError: string | null;
  runtimeApplyIsActive: boolean;
  slackIsConnected: boolean;
}): SlackStatusVariant {
  if (props.effectiveSlackError || props.runtimeApplyError) {
    return "destructive";
  }

  if (props.runtimeApplyIsActive) {
    return "secondary";
  }

  if (props.slackIsConnected) {
    return "outline";
  }

  return "secondary";
}

function getStatusAlert(props: {
  effectiveSlackError: string | null;
  runtimeApplyError: string | null;
  runtimeApplyIsActive: boolean;
  slackIsConnected: boolean;
}) {
  if (props.effectiveSlackError) {
    return {
      description: props.effectiveSlackError,
      title: "Slack could not be connected",
      variant: "destructive" as const,
    };
  }

  if (props.runtimeApplyError) {
    return {
      description: props.runtimeApplyError,
      title: "Slack is connected, but Otto could not finish the latest update",
      variant: "destructive" as const,
    };
  }

  if (props.runtimeApplyIsActive) {
    return {
      description:
        "Slack is connected. Otto is applying the latest Slack settings in the background now.",
      title: "Otto is updating",
      variant: "default" as const,
    };
  }

  if (!props.slackIsConnected) {
    return {
      description:
        "Connect Slack so your team can ask Otto for help where conversations already happen.",
      title: "Slack is not connected yet",
      variant: "default" as const,
    };
  }

  return null;
}

export async function SlackManagedIntegrationPage({
  orgSlug,
  section,
  userExternalId,
}: {
  orgSlug: string;
  section: string | null;
  userExternalId: string;
}) {
  const definition = getIntegrationDefinition("slack");

  if (!definition) {
    throw new Error("Integration definition for Slack is missing.");
  }

  const currentSection =
    section === "capabilities" ||
    section === "channels" ||
    section === "configuration" ||
    section === "people" ||
    section === "status"
      ? section
      : "status";

  if (section && currentSection !== section) {
    redirect(
      buildIntegrationSectionPath({
        integrationKey: definition.key,
        orgSlug,
        section: "status",
      }),
    );
  }

  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  const session = getCurrentOnboardingSession(organization);
  const summary = await getTenantManagedIntegrationSummary({
    orgSlug,
    providerKey: definition.key,
    userExternalId,
  });
  const capabilityRows = (
    await listManagedIntegrationCapabilitiesForOrganization({
      orgSlug,
      providerKey: definition.key,
      userExternalId,
    })
  ).map(
    (row): CapabilityInventoryRow => ({
      ...row,
      policyEndpoint: `/api/integrations/${orgSlug}/${definition.key}/capabilities/${encodeURIComponent(row.capabilityKey)}/policy`,
      reason: row.capabilityState.reason ?? null,
      searchText: [
        row.label,
        row.description,
        row.commandGroup ?? "",
        row.commandKey,
        row.capabilityState.reason ?? "",
      ]
        .join(" ")
        .toLowerCase(),
      status: row.capabilityState.status,
    }),
  );
  const slackIsConnected = Boolean(
    summary?.connectedAt && !summary?.disconnectedAt,
  );
  const integrationStatus = summary?.status ?? null;
  const onboardingSlackError =
    organization.onboardingDraft?.slackOauthError ??
    organization.latestOnboardingSession?.slackOauthError ??
    null;
  const connectionError =
    integrationStatus === "error"
      ? (summary?.lastError ?? onboardingSlackError)
      : onboardingSlackError;
  const runtimeApplyStatusLabel = getRuntimeApplyStatusLabel(organization);
  const runtimeApplyError =
    integrationStatus === "apply_failed" ? (summary?.lastError ?? null) : null;
  const connectedAt = summary?.connectedAt ?? session?.slackConnectedAt ?? null;
  const slackTeamName =
    organization.slackIntegration?.teamName ?? session?.slackTeamName ?? null;
  const runtimeApplyIsActive =
    integrationStatus === "pending_apply" || integrationStatus === "applying";
  const connectUrl = buildSlackWorkspaceOauthStartUrl({
    hasSlackOAuthConfig: hasSlackOAuthConfig(),
    orgSlug,
  });
  const connectActionLabel =
    slackIsConnected || connectionError ? "Reconnect Slack" : "Connect Slack";
  const canReconnectSlack = Boolean(connectUrl) && slackIsConnected;
  const slackDirectoryRefresh = slackIsConnected
    ? await refreshTenantSlackDirectory({
        orgSlug,
        userExternalId,
      })
    : null;
  const slackRuntimeConfigSurface = await getTenantSlackRuntimeConfigSurface({
    orgSlug,
    userExternalId,
  });
  const statusAlert = getStatusAlert({
    effectiveSlackError: connectionError,
    runtimeApplyError,
    runtimeApplyIsActive,
    slackIsConnected,
  });

  return (
    <div className="flex w-full max-w-none flex-col gap-6 pb-12">
      <section className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex max-w-3xl flex-col gap-2">
            <div className="flex items-center gap-3">
              <Image
                alt=""
                className="size-8"
                height={32}
                src="/integrations/slack.svg"
                width={32}
              />
              <h1 className="text-3xl font-semibold tracking-tight">Slack</h1>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {definition.pageDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {connectUrl && !slackIsConnected ? (
              <a
                className={buttonVariants({ variant: "default" })}
                href={connectUrl}
              >
                {connectActionLabel}
              </a>
            ) : null}
            {slackIsConnected ? (
              <SlackActionsMenu
                canReconnect={canReconnectSlack}
                orgSlug={organization.slug}
                reconnectUrl={canReconnectSlack ? connectUrl : null}
              />
            ) : null}
          </div>
        </div>
      </section>

      <SlackIntegrationPanel
        capabilityRows={capabilityRows}
        connectActionLabel={connectActionLabel}
        connectUrl={connectUrl}
        connectedAtLabel={connectedAt ? connectedAt.toISOString() : null}
        currentSection={currentSection}
        directoryRefreshError={slackDirectoryRefresh?.error ?? null}
        disconnectAvailable={slackIsConnected && !runtimeApplyIsActive}
        initialSurface={slackRuntimeConfigSurface}
        orgSlug={orgSlug}
        runtimeApplyStatusLabel={runtimeApplyStatusLabel}
        runtimeStatusLabel={getRuntimeStatusLabel(organization)}
        slackStatusLabel={getSlackStatusLabel(organization)}
        slackStatusVariant={getStatusBadgeVariant({
          effectiveSlackError: connectionError,
          runtimeApplyError,
          runtimeApplyIsActive,
          slackIsConnected,
        })}
        slackTeamName={slackTeamName}
        statusAlert={statusAlert}
      />
    </div>
  );
}

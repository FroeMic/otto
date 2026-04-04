import Image from "next/image";
import Link from "next/link";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { SlackActionsMenu } from "@/app/[orgSlug]/(app)/integrations/slack/_components/slack-actions-menu";
import { SlackRuntimeConfigPanel } from "@/app/[orgSlug]/(app)/integrations/slack/_components/slack-runtime-config-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getTenantSlackRuntimeConfigSurface,
  refreshTenantSlackDirectory,
} from "@/db/control-plane";
import { hasSlackOAuthConfig } from "@/lib/env";
import {
  getCurrentOnboardingSession,
  getPrimaryAgentLatestApplyRun,
  getRuntimeApplyStatusLabel,
  getRuntimeStatusLabel,
  getSlackStatusLabel,
  isOrganizationUnlocked,
  isSlackConnected,
} from "@/lib/workspace";
import { getToolDefinition } from "@/tools";

export const dynamic = "force-dynamic";

function getStatusBadgeVariant(props: {
  effectiveSlackError: string | null;
  runtimeApplyError: string | null;
  runtimeApplyIsActive: boolean;
  slackIsConnected: boolean;
}) {
  if (props.effectiveSlackError || props.runtimeApplyError) {
    return "destructive" as const;
  }

  if (props.runtimeApplyIsActive) {
    return "secondary" as const;
  }

  if (props.slackIsConnected) {
    return "outline" as const;
  }

  return "secondary" as const;
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

export default async function SlackIntegrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ slack_connected?: string; slack_error?: string }>;
}) {
  const { orgSlug } = await params;
  const { slack_error: slackError } = await searchParams;
  const { currentOrganization: organization, user } =
    await loadOrganizationRouteContext(orgSlug);

  const session = getCurrentOnboardingSession(organization);
  const latestApplyRun = getPrimaryAgentLatestApplyRun(organization);
  const sessionId = session?.id ?? null;
  const slackIsConnected = isSlackConnected(organization);
  const integrationStatus = organization.slackIntegration?.status ?? null;
  const onboardingSlackError =
    organization.onboardingDraft?.slackOauthError ??
    organization.latestOnboardingSession?.slackOauthError ??
    null;
  const connectionError =
    integrationStatus === "error"
      ? (organization.slackIntegration?.lastError ?? onboardingSlackError)
      : onboardingSlackError;
  const effectiveSlackError = slackError ?? connectionError;
  const runtimeApplyStatusLabel = getRuntimeApplyStatusLabel(organization);
  const runtimeApplyError =
    integrationStatus === "apply_failed"
      ? (organization.slackIntegration?.lastError ??
        latestApplyRun?.error ??
        null)
      : latestApplyRun?.status === "failed"
        ? latestApplyRun.error
        : null;
  const connectedAt =
    organization.slackIntegration?.connectedAt ?? session?.slackConnectedAt;
  const slackTeamName =
    organization.slackIntegration?.teamName ?? session?.slackTeamName;
  const ottoIsReady = isOrganizationUnlocked(organization);
  const canRetrySlackDuringSetup =
    hasSlackOAuthConfig() &&
    Boolean(sessionId) &&
    (!slackIsConnected || Boolean(effectiveSlackError)) &&
    !ottoIsReady;
  const runtimeApplyIsActive =
    integrationStatus === "pending_apply" ||
    integrationStatus === "applying" ||
    latestApplyRun?.status === "queued" ||
    latestApplyRun?.status === "loading_desired_state" ||
    latestApplyRun?.status === "rendering_files" ||
    latestApplyRun?.status === "writing_files" ||
    latestApplyRun?.status === "restarting_runtime" ||
    latestApplyRun?.status === "verifying_runtime";
  const canReconnectSlack =
    hasSlackOAuthConfig() &&
    Boolean(sessionId) &&
    slackIsConnected &&
    !runtimeApplyIsActive;
  const slackDirectoryRefresh = slackIsConnected
    ? await refreshTenantSlackDirectory({
        orgSlug,
        userExternalId: user.id,
      })
    : null;
  const slackRuntimeConfigSurface = slackIsConnected
    ? await getTenantSlackRuntimeConfigSurface({
        orgSlug,
        userExternalId: user.id,
      })
    : null;
  const statusAlert = getStatusAlert({
    effectiveSlackError,
    runtimeApplyError,
    runtimeApplyIsActive,
    slackIsConnected,
  });
  const slackToolDefinition = getToolDefinition("channel", "slack");

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 pb-12">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
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
              Choose who can use Otto in Slack and where Otto can reply.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {canRetrySlackDuringSetup && sessionId ? (
              <a
                className={buttonVariants({ variant: "default" })}
                href={`/oauth/start/slack?onboardingSessionId=${sessionId}`}
              >
                {effectiveSlackError ? "Retry Slack" : "Connect Slack"}
              </a>
            ) : null}
            {slackIsConnected && !ottoIsReady ? (
              <Link
                className={buttonVariants({ variant: "default" })}
                href={`/${organization.slug}/onboarding`}
              >
                Continue setup
              </Link>
            ) : null}
            {slackIsConnected ? (
              <SlackActionsMenu
                orgSlug={organization.slug}
                reconnectUrl={
                  canReconnectSlack && sessionId && ottoIsReady
                    ? `/oauth/start/slack?onboardingSessionId=${sessionId}`
                    : null
                }
                canReconnect={canReconnectSlack && !!sessionId && ottoIsReady}
              />
            ) : null}
          </div>
        </div>
      </section>

      <SlackRuntimeConfigPanel
        agentCapabilities={slackToolDefinition?.agentCapabilities ?? []}
        connectedAtLabel={connectedAt ? connectedAt.toISOString() : null}
        directoryRefreshError={slackDirectoryRefresh?.error ?? null}
        initialSurface={slackRuntimeConfigSurface}
        orgSlug={orgSlug}
        runtimeApplyStatusLabel={runtimeApplyStatusLabel}
        runtimeStatusLabel={getRuntimeStatusLabel(organization)}
        slackStatusLabel={getSlackStatusLabel(organization)}
        slackStatusVariant={getStatusBadgeVariant({
          effectiveSlackError,
          runtimeApplyError,
          runtimeApplyIsActive,
          slackIsConnected,
        })}
        slackTeamName={slackTeamName ?? null}
        statusAlert={statusAlert}
      />
    </div>
  );
}

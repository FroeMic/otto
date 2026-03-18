import Link from "next/link";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { SlackRuntimeConfigPanel } from "@/app/[orgSlug]/(app)/integrations/slack/_components/slack-runtime-config-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Separator } from "@/components/ui/separator";
import {
  getTenantSlackRuntimeConfigSurface,
  refreshTenantSlackDirectory,
} from "@/db/control-plane";
import { hasSlackOAuthConfig } from "@/lib/env";
import {
  getCurrentOnboardingSession,
  getPrimaryAgent,
  getPrimaryAgentLatestApplyRun,
  getRuntimeApplyStatusLabel,
  getRuntimeStatusLabel,
  getSlackStatusLabel,
  isOrganizationUnlocked,
  isSlackConnected,
} from "@/lib/workspace";

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
  const agent = getPrimaryAgent(organization);
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-12">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Integrations / Slack</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">Slack</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Manage how Otto connects to Slack, who can reach it, and where
                  it is allowed to respond.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge
                  variant={getStatusBadgeVariant({
                    effectiveSlackError,
                    runtimeApplyError,
                    runtimeApplyIsActive,
                    slackIsConnected,
                  })}
                >
                  {getSlackStatusLabel(organization)}
                </Badge>
                {slackTeamName ? <span>Workspace: {slackTeamName}</span> : null}
                <span>Otto: {getRuntimeStatusLabel(organization)}</span>
                {runtimeApplyStatusLabel ? (
                  <span>Latest sync: {runtimeApplyStatusLabel}</span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {canRetrySlackDuringSetup && sessionId ? (
                <a
                  className={buttonVariants({ variant: "default" })}
                  href={`/oauth/start/slack?onboardingSessionId=${sessionId}`}
                >
                  {effectiveSlackError ? "Retry Slack" : "Add to Slack"}
                </a>
              ) : null}
              {canReconnectSlack && sessionId && ottoIsReady ? (
                <a
                  className={buttonVariants({ variant: "default" })}
                  href={`/oauth/start/slack?onboardingSessionId=${sessionId}`}
                >
                  Reconnect Slack
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
            </div>
          </div>
        </div>

        {statusAlert ? (
          <Alert variant={statusAlert.variant}>
            <AlertTitle>{statusAlert.title}</AlertTitle>
            <AlertDescription>{statusAlert.description}</AlertDescription>
          </Alert>
        ) : null}

        {slackDirectoryRefresh?.error ? (
          <Alert>
            <AlertTitle>Slack directory could not be refreshed</AlertTitle>
            <AlertDescription>
              Showing the last synced Slack users and channels instead.{" "}
              {slackDirectoryRefresh.error}
            </AlertDescription>
          </Alert>
        ) : null}
      </section>

      <Separator />

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          {connectedAt ? (
            <span>Connected {connectedAt.toLocaleString()}</span>
          ) : null}
          {agent && !ottoIsReady ? (
            <span>Otto is still finishing setup steps in the background.</span>
          ) : null}
        </div>
        <Link href={`/${organization.slug}/integrations`}>
          View all integrations
        </Link>
      </div>

      {slackRuntimeConfigSurface ? (
        <SlackRuntimeConfigPanel
          initialSurface={slackRuntimeConfigSurface}
          orgSlug={orgSlug}
        />
      ) : null}
    </div>
  );
}

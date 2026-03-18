import Link from "next/link";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export default async function SlackIntegrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ slack_connected?: string; slack_error?: string }>;
}) {
  const { orgSlug } = await params;
  const { slack_connected: slackConnected, slack_error: slackError } =
    await searchParams;
  const { currentOrganization: organization } =
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

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Integrations / Slack</p>
        <h1 className="text-3xl font-semibold">Slack connection</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Add Otto to Slack so your team can ask for help and keep work moving
          where conversations already happen.
        </p>
      </section>

      {slackConnected && !runtimeApplyIsActive ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            Slack is connected.
          </CardContent>
        </Card>
      ) : null}

      {effectiveSlackError ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            Slack could not be connected. {effectiveSlackError}
          </CardContent>
        </Card>
      ) : null}

      {runtimeApplyIsActive ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            Slack is connected. Otto is updating in the background now.
          </CardContent>
        </Card>
      ) : null}

      {runtimeApplyError ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            Slack is connected, but the latest Otto update did not finish.{" "}
            {runtimeApplyError}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Connection status</CardTitle>
            <CardDescription>
              {getSlackStatusLabel(organization)}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {connectedAt && integrationStatus === "pending_apply"
              ? `Connected${slackTeamName ? ` to ${slackTeamName}` : ""}. Otto will pick up the new Slack connection shortly.`
              : connectedAt && integrationStatus === "applying"
                ? `Connected${slackTeamName ? ` to ${slackTeamName}` : ""}. Otto is updating now.`
                : connectedAt && integrationStatus === "apply_failed"
                  ? `Connected${slackTeamName ? ` to ${slackTeamName}` : ""}. The latest Otto update did not finish.`
                  : connectedAt
                    ? `Connected${slackTeamName ? ` to ${slackTeamName}` : ""} on ${connectedAt.toLocaleString()}.`
                    : "Slack is not connected yet."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Otto status</CardTitle>
            <CardDescription>
              Current status: {getRuntimeStatusLabel(organization)}
              {runtimeApplyStatusLabel
                ? `. Latest sync: ${runtimeApplyStatusLabel}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {runtimeApplyIsActive
              ? "Otto is picking up the latest Slack settings now."
              : runtimeApplyError
                ? "Otto stays on the last good setup until the next update succeeds."
                : agent
                  ? "Otto is still finishing a few setup steps in the background."
                  : "Otto will finish getting ready after Slack is connected."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next action</CardTitle>
            <CardDescription>
              {runtimeApplyIsActive
                ? "Wait for Otto to finish updating."
                : runtimeApplyError
                  ? "Reconnect Slack to try the update again."
                  : effectiveSlackError && !ottoIsReady
                    ? "Retry Slack so Otto can finish setup."
                    : !slackIsConnected
                      ? "Connect Slack so your team can start using Otto there."
                      : !ottoIsReady
                        ? "Finish the last setup steps to unlock Otto."
                        : "Everything is connected. Open Otto and start using it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {canRetrySlackDuringSetup && sessionId ? (
              <a
                className={buttonVariants({ variant: "default" })}
                href={`/oauth/start/slack?onboardingSessionId=${sessionId}`}
              >
                {effectiveSlackError
                  ? "Retry Slack connection"
                  : "Add to Slack"}
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
            {ottoIsReady ? (
              <Link
                className={buttonVariants({ variant: "default" })}
                href={`/${organization.slug}/agent/status`}
              >
                Open Otto
              </Link>
            ) : null}
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/${organization.slug}/integrations`}
            >
              View all integrations
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

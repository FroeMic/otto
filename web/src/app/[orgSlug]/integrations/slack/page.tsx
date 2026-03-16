import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardOrganizations } from "@/db/control-plane";
import { hasSlackOAuthConfig } from "@/lib/env";
import {
  getCurrentOnboardingSession,
  getPrimaryAgent,
  getRuntimeStatusLabel,
  getSlackErrorMessage,
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
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await params;
  const { slack_connected: slackConnected, slack_error: slackError } =
    await searchParams;
  const organizations = await getDashboardOrganizations(user.id);
  const organization = organizations.find((item) => item.slug === orgSlug);

  if (!organization) {
    notFound();
  }

  const session = getCurrentOnboardingSession(organization);
  const agent = getPrimaryAgent(organization);
  const sessionId = session?.id ?? null;
  const slackIsConnected = isSlackConnected(organization);
  const persistedSlackError = getSlackErrorMessage(organization);
  const effectiveSlackError = slackError ?? persistedSlackError;
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

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Integrations / Slack</p>
        <h1 className="text-3xl font-semibold">Slack connection</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Add Otto to Slack so your team can ask for help, delegate work, and
          get results back where conversations already happen.
        </p>
      </section>

      {slackConnected ? (
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

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Connection status</CardTitle>
            <CardDescription>
              {getSlackStatusLabel(organization)}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {connectedAt
              ? `Connected${slackTeamName ? ` to ${slackTeamName}` : ""} on ${connectedAt.toLocaleString()}.`
              : "Slack is not connected yet."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Otto status</CardTitle>
            <CardDescription>
              Current status: {getRuntimeStatusLabel(organization)}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {agent
              ? "Otto is still finishing a few setup steps in the background."
              : "Otto will finish getting ready after Slack is connected."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next action</CardTitle>
            <CardDescription>
              {effectiveSlackError && !ottoIsReady
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
                href={`/${organization.slug}/agent`}
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

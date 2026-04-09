import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createOnboardingDraftForOrganization } from "@/db/control-plane";
import { buildSlackOnboardingOauthStartUrl } from "@/integrations/library/slack/oauth-url";
import { hasSlackOAuthConfig } from "@/lib/env";
import {
  getCurrentOnboardingSession,
  getPrimaryAgent,
  getRuntimeStatusLabel,
  getSlackErrorMessage,
  isOrganizationUnlocked,
  isSlackConnected,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

function getOttoSetupMessage(agent: ReturnType<typeof getPrimaryAgent>) {
  if (!agent) {
    return "Waiting for Slack before Otto can start getting ready.";
  }

  if (agent.serverStatus === "ready" && agent.status === "ready") {
    return "Otto is ready for your team.";
  }

  switch (agent.latestJob?.step) {
    case "create_server":
      return "Creating Otto's server.";
    case "wait_for_hetzner_action":
      return "Waiting for the server to finish being created.";
    case "fetch_server_ip":
      return "Assigning Otto a network address.";
    case "wait_for_ssh":
      return "Waiting for the server to accept secure connections.";
    case "wait_for_host_bootstrap":
      return "Preparing the server and installing the basics.";
    case "bootstrap_runtime":
      return "Installing Otto on the server.";
    case "start_runtime":
      return "Starting Otto.";
    case "verify_runtime":
      return "Checking that Otto is up and running.";
    case "mark_server_ready":
      return "Finishing the last setup steps.";
    default:
      return "Otto is getting everything ready in the background.";
  }
}

async function createDraftAction(formData: FormData) {
  "use server";

  const { user } = await withAuth({ ensureSignedIn: true });
  const organizationId = formData.get("organizationId")?.toString();

  if (!organizationId) {
    throw new Error("Organization is required");
  }

  await createOnboardingDraftForOrganization({
    organizationId,
    userExternalId: user.id,
  });
}

export default async function OrganizationOnboardingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  if (isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/agent/status`);
  }

  const onboardingSession = getCurrentOnboardingSession(organization);
  const agent = getPrimaryAgent(organization);
  const onboardingSessionId = onboardingSession?.id ?? null;
  const slackOauthStartUrl = buildSlackOnboardingOauthStartUrl({
    hasSlackOAuthConfig: hasSlackOAuthConfig(),
    onboardingSessionId,
  });
  const slackIsConnected = isSlackConnected(organization);
  const slackError = getSlackErrorMessage(organization);
  const slackTeamName =
    organization.slackIntegration?.teamName ?? onboardingSession?.slackTeamName;
  const ottoStatus = getRuntimeStatusLabel(organization);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Onboarding</p>
            <h1 className="text-3xl font-semibold">
              Get Otto ready for your team
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Connect Slack and finish the first setup steps. After that, your
              team can start using Otto in the flow they already know.
            </p>
            {slackIsConnected ? (
              <p className="text-sm text-muted-foreground">
                Slack is connected. Otto is still getting ready.
              </p>
            ) : null}
          </div>
          <a
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            href="/auth/sign-out"
          >
            Log out
          </a>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>1. Workspace details</CardTitle>
            <CardDescription>
              Your workspace name and workspace URL are already set up.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {organization.name} will use `/{organization.slug}` as its workspace
            URL.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>2. Slack</CardTitle>
            <CardDescription>
              Add Otto to Slack so your team can message it like a coworker.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <Badge
              className={
                slackIsConnected
                  ? "border-green-200 bg-green-50 text-green-700"
                  : undefined
              }
              variant={slackIsConnected ? "outline" : "secondary"}
            >
              {slackIsConnected ? "Slack connected" : "Slack not connected"}
            </Badge>
            <p>
              {slackIsConnected
                ? `Connected${slackTeamName ? ` to ${slackTeamName}` : ""}.`
                : slackError
                  ? `Last connection attempt failed: ${slackError}`
                  : "Slack is not connected yet."}
            </p>
            {(!slackIsConnected || Boolean(slackError)) &&
            slackOauthStartUrl ? (
              <a
                className={buttonVariants({ variant: "default" })}
                href={slackOauthStartUrl}
              >
                {slackError ? "Retry Slack connection" : "Add to Slack"}
              </a>
            ) : null}
            {!hasSlackOAuthConfig() ? (
              <p>Slack connection is not available in this preview yet.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>3. Otto setup</CardTitle>
            <CardDescription>
              Otto finishes the last setup steps after Slack is connected.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <Badge variant="secondary">{ottoStatus}</Badge>
            <p>{getOttoSetupMessage(agent)}</p>
          </CardContent>
        </Card>
      </div>

      {!organization.onboardingDraft && !agent ? (
        <Card>
          <CardHeader>
            <CardTitle>Start setup</CardTitle>
            <CardDescription>
              Start the setup flow for this workspace before you connect Slack.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createDraftAction}>
              <input
                type="hidden"
                name="organizationId"
                value={organization.id}
              />
              <Button type="submit">Start setup</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

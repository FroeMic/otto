import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardOrganization } from "@/db/control-plane";
import {
  getAgentReadinessSummary,
  getOrganizationHomePath,
  getSlackErrorMessage,
  isOrganizationUnlocked,
  isRuntimeReady,
  isSlackConnected,
} from "@/lib/workspace";

type StatusRailModel = {
  actionHref?: string;
  actionLabel?: string;
  actionVariant?: "default" | "outline";
  badgeLabel: string;
  detail: string;
  title: string;
  variant: "default" | "secondary" | "destructive" | "outline";
};

function getStatusRailModel(
  organization: DashboardOrganization,
): StatusRailModel {
  const readiness = getAgentReadinessSummary(organization);
  const teamName =
    organization.slackIntegration?.teamName ??
    organization.latestOnboardingSession?.slackTeamName;
  const slackConnected = isSlackConnected(organization);
  const slackError = getSlackErrorMessage(organization);
  const statusPath = `/${organization.slug}/agent/status`;
  const slackPath = `/${organization.slug}/integrations/slack`;

  if (slackError) {
    return {
      actionHref: slackPath,
      actionLabel: "Review Slack",
      actionVariant: "outline",
      badgeLabel: "Needs attention",
      detail: teamName
        ? `Reconnect Slack workspace ${teamName} to keep Otto available here.`
        : "Reconnect Slack to keep Otto available in this workspace.",
      title: "Slack connection needs attention",
      variant: "destructive",
    };
  }

  if (readiness.label === "Needs attention") {
    return {
      actionHref: statusPath,
      actionLabel: "View status",
      actionVariant: "outline",
      badgeLabel: readiness.label,
      detail: "A recent Otto update needs attention before it can continue.",
      title: "Otto update needs attention",
      variant: readiness.variant,
    };
  }

  if (readiness.label === "Updating") {
    return {
      actionHref: statusPath,
      actionLabel: "View status",
      actionVariant: "outline",
      badgeLabel: readiness.label,
      detail: "Applying a recent change for this workspace.",
      title: "Otto is updating",
      variant: readiness.variant,
    };
  }

  if (!slackConnected) {
    return {
      actionHref: slackPath,
      actionLabel: "Connect Slack",
      actionVariant: "default",
      badgeLabel: "Setup required",
      detail: "Connect Slack to finish preparing Otto for this workspace.",
      title: "Connect Slack to finish setup",
      variant: "outline",
    };
  }

  if (!isOrganizationUnlocked(organization) || !isRuntimeReady(organization)) {
    return {
      actionHref: getOrganizationHomePath(organization),
      actionLabel: "Finish setup",
      actionVariant: "default",
      badgeLabel: "Setup required",
      detail: "Otto is still being prepared for this workspace.",
      title: "Otto is still getting ready",
      variant: readiness.variant,
    };
  }

  return {
    badgeLabel: "Ready",
    detail: teamName
      ? `Connected to Slack workspace ${teamName}.`
      : "Slack is connected and Otto is ready in this workspace.",
    title: "Otto is ready",
    variant: readiness.variant,
  };
}

export function WorkspaceStatusRail({
  organization,
}: {
  organization: DashboardOrganization;
}) {
  const status = getStatusRailModel(organization);

  return (
    <footer className="sticky bottom-0 z-10 shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <Badge className="mt-0.5 shrink-0" variant={status.variant}>
            {status.badgeLabel}
          </Badge>
          <div className="min-w-0">
            <p className="text-sm font-medium">{status.title}</p>
            <p className="text-sm text-muted-foreground">{status.detail}</p>
          </div>
        </div>
        {status.actionHref && status.actionLabel ? (
          <Button
            size="sm"
            variant={status.actionVariant ?? "outline"}
            render={<Link href={status.actionHref} />}
          >
            {status.actionLabel}
          </Button>
        ) : null}
      </div>
    </footer>
  );
}

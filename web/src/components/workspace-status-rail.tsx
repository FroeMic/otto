import { Badge } from "@/components/ui/badge";
import type { DashboardOrganization } from "@/db/control-plane";
import {
  getRuntimeStatusLabel,
  getSlackStatusLabel,
  isOrganizationUnlocked,
} from "@/lib/workspace";

export function WorkspaceStatusRail({
  organization,
}: {
  organization: DashboardOrganization;
}) {
  const teamName =
    organization.slackIntegration?.teamName ??
    organization.latestOnboardingSession?.slackTeamName;

  return (
    <footer className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-col gap-3 px-4 py-3 text-xs md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{organization.name}</Badge>
          <Badge variant="secondary">
            Slack: {getSlackStatusLabel(organization)}
          </Badge>
          <Badge variant="secondary">
            Otto: {getRuntimeStatusLabel(organization)}
          </Badge>
          <Badge
            variant={
              isOrganizationUnlocked(organization) ? "default" : "outline"
            }
          >
            {isOrganizationUnlocked(organization) ? "Ready" : "Setup required"}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          {teamName
            ? `Slack is connected to ${teamName}.`
            : "Connect Slack to bring Otto into your workspace."}
        </p>
      </div>
    </footer>
  );
}

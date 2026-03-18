import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPrimaryAgent,
  getRuntimeStatusLabel,
  getSlackStatusLabel,
  isOrganizationUnlocked,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getLatestActivitySummary(event: { createdAt: Date; message: string }) {
  return {
    message: event.message || "Otto recorded a new update.",
    time: formatTimestamp(event.createdAt),
  };
}

export default async function AgentStatusPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const agent = getPrimaryAgent(organization);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Slack</CardTitle>
            <CardDescription>Where your team can reach Otto</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">
              {getSlackStatusLabel(organization)}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
            <CardDescription>Whether Otto is ready to help</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">
              {getRuntimeStatusLabel(organization)}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Agent</CardTitle>
            <CardDescription>Your workspace assistant</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {agent ? agent.name : "Otto is still getting ready."}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            The latest updates from Otto while it was being prepared for your
            workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agent?.latestJob ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Update</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.latestJob.events.map((event) => {
                  const activity = getLatestActivitySummary(event);

                  return (
                    <TableRow
                      key={`${event.eventType}-${event.createdAt.toISOString()}`}
                    >
                      <TableCell>{activity.message}</TableCell>
                      <TableCell>{activity.time}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No activity has been recorded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

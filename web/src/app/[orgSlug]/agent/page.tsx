import { withAuth } from "@workos-inc/authkit-nextjs";
import { notFound, redirect } from "next/navigation";

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
import { getDashboardOrganizations } from "@/db/control-plane";
import {
  getPrimaryAgent,
  getRuntimeStatusLabel,
  getSlackStatusLabel,
  isOrganizationUnlocked,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await params;
  const organizations = await getDashboardOrganizations(user.id);
  const organization = organizations.find((item) => item.slug === orgSlug);

  if (!organization) {
    notFound();
  }

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const agent = getPrimaryAgent(organization);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Agent</p>
        <h1 className="text-3xl font-semibold">How Otto is doing</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Check whether Otto is connected, ready to help, and what happened most
          recently while it was getting set up.
        </p>
      </section>

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
            <CardTitle>Status</CardTitle>
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
            <CardDescription>Your team's Otto</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {agent ? agent.name : "Otto is still being prepared."}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent setup activity</CardTitle>
          <CardDescription>
            The latest steps Otto went through while getting ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agent?.latestJob ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.latestJob.events.map((event) => (
                  <TableRow
                    key={`${event.eventType}-${event.createdAt.toISOString()}`}
                  >
                    <TableCell>{event.eventType}</TableCell>
                    <TableCell>{event.message}</TableCell>
                    <TableCell>{event.createdAt.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No setup activity has been recorded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

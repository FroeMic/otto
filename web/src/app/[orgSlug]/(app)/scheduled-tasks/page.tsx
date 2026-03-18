import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ScheduledTasksPage({
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Tasks</CardTitle>
        <CardDescription>
          Set up recurring work for Otto to run on a schedule.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Scheduled tasks are coming soon.
      </CardContent>
    </Card>
  );
}

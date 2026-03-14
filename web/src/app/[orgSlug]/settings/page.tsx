import { withAuth } from "@workos-inc/authkit-nextjs";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDashboardOrganizations } from "@/db/control-plane";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
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

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Settings</p>
        <h1 className="text-3xl font-semibold">Team and account settings</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage your own sign-in details and the basic details for the team
          Otto works with.
        </p>
      </section>

      <Tabs defaultValue="user" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="user">User settings</TabsTrigger>
          <TabsTrigger value="organization">Team settings</TabsTrigger>
        </TabsList>
        <TabsContent value="user" id="user-settings">
          <Card>
            <CardHeader>
              <CardTitle>User settings</CardTitle>
              <CardDescription>
                Your personal details and how you access Otto.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>Name: {fullName}</p>
              <p>Email: {user.email}</p>
              <a
                className="underline"
                href="https://dashboard.workos.com"
                rel="noreferrer"
                target="_blank"
              >
                Manage sign-in
              </a>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>Team settings</CardTitle>
              <CardDescription>
                The basics your team sees inside Otto.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>Name: {organization.name}</p>
              <p>Otto link: {organization.slug}</p>
              <p>Role: {organization.role}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

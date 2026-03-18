import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function UserSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { user } = await loadOrganizationRouteContext(orgSlug);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Settings / User</p>
        <h1 className="text-3xl font-semibold">Account</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage your name, email, and sign-in details.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            These details are used to identify you across Otto.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>Name: {user.name}</p>
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
    </div>
  );
}

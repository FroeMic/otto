import Link from "next/link";
import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listTenantToolConfigSurfaces } from "@/db/control-plane";
import { isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization, user } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const surfaces = (
    await listTenantToolConfigSurfaces({
      orgSlug,
      userExternalId: user.id,
    })
  ).filter((surface) => surface.uiGroup === "tools");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Tools</p>
        <h1 className="text-3xl font-semibold">Agent capabilities</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Review the runtime capabilities Otto exposes to your tenant agent.
        </p>
      </section>

      {surfaces.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No tools available</CardTitle>
            <CardDescription>
              Otto has not projected any shared runtime tools into this tenant
              yet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {surfaces.map((surface) => (
            <Card key={surface.id}>
              <CardHeader>
                <CardTitle>{surface.label}</CardTitle>
                <CardDescription>{surface.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <p>
                    Status:{" "}
                    <span className="font-medium text-foreground">
                      {surface.availability === "available"
                        ? "Available"
                        : "Blocked"}
                    </span>
                  </p>
                  {surface.blockingReason ? (
                    <p>{surface.blockingReason}</p>
                  ) : null}
                </div>
                <Link
                  className={buttonVariants({ variant: "default" })}
                  href={`/${organization.slug}/tools/${surface.kind}/${surface.key}`}
                >
                  Open tool
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { withAuth } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getDashboardOrganizations,
  getLatestTenantManagedConfig,
  updateTenantManagedFileSharedContent,
} from "@/db/control-plane";
import { isManagedBootstrapFilePath } from "@/lib/openclaw/managed-config";

export const dynamic = "force-dynamic";

async function updateManagedConfigAction(formData: FormData) {
  "use server";

  const { user } = await withAuth({ ensureSignedIn: true });
  const orgSlug = formData.get("orgSlug")?.toString();
  const filePath = formData.get("filePath")?.toString();
  const sharedContent = formData.get("sharedContent")?.toString();

  if (!orgSlug || !filePath || !sharedContent) {
    throw new Error("Managed config update is missing required fields");
  }

  if (!isManagedBootstrapFilePath(filePath)) {
    throw new Error(`Unsupported managed config file: ${filePath}`);
  }

  await updateTenantManagedFileSharedContent({
    filePath,
    orgSlug,
    sharedContent,
    userExternalId: user.id,
  });

  revalidatePath(`/${orgSlug}/settings`);
}

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
  const primaryTenant = organization.tenants[0] ?? null;
  const managedConfig = primaryTenant
    ? await getLatestTenantManagedConfig(primaryTenant.id)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Settings</p>
        <h1 className="text-3xl font-semibold">Team and account settings</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage your personal access, core team details, and the managed
          bootstrap files Otto reads from the tenant runtime.
        </p>
      </section>

      <Tabs defaultValue="managed-config" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="managed-config">Managed config</TabsTrigger>
          <TabsTrigger value="user">User settings</TabsTrigger>
          <TabsTrigger value="organization">Team settings</TabsTrigger>
        </TabsList>
        <TabsContent value="managed-config" id="managed-config-settings">
          {!primaryTenant || !managedConfig ? (
            <Card>
              <CardHeader>
                <CardTitle>Managed config</CardTitle>
                <CardDescription>
                  Managed bootstrap files become available after this workspace
                  has a tenant runtime.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>Managed bootstrap files</CardTitle>
                    <Badge variant="outline">
                      Managed config v{managedConfig.version}
                    </Badge>
                    {primaryTenant.latestApplyRun ? (
                      <Badge variant="outline">
                        Runtime apply {primaryTenant.latestApplyRun.status}
                      </Badge>
                    ) : null}
                  </div>
                  <CardDescription>
                    These files are canonical in the control plane and are
                    projected into the tenant runtime workspace root as
                    `AGENTS.md`, `IDENTITY.md`, and `TOOLS.md`. The system block
                    is locked. The shared block can be changed by both the user
                    and Otto through managed-config tools.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <p>Tenant runtime: {primaryTenant.name}</p>
                  <p>Tenant status: {primaryTenant.status}</p>
                  <p>
                    Latest managed config author: {managedConfig.createdByType}
                    {managedConfig.createdByExternalId
                      ? ` (${managedConfig.createdByExternalId})`
                      : ""}
                  </p>
                </CardContent>
              </Card>

              {managedConfig.files.map((file) => (
                <Card key={file.path}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{file.path}</CardTitle>
                      <Badge variant="outline">{file.label}</Badge>
                      <Badge variant="outline">
                        {file.checksum.slice(0, 12)}
                      </Badge>
                    </div>
                    <CardDescription>{file.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <section className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-medium">System block</h2>
                          <Badge variant="secondary">Locked</Badge>
                        </div>
                        <pre className="overflow-x-auto border border-border bg-muted/30 p-3 text-xs leading-6 whitespace-pre-wrap text-muted-foreground">
                          {file.systemContent}
                        </pre>
                      </section>
                      <section className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-medium">
                            Shared editable block
                          </h2>
                          <Badge variant="outline">User + Otto</Badge>
                        </div>
                        <form
                          action={updateManagedConfigAction}
                          className="flex flex-col gap-3"
                        >
                          <input
                            type="hidden"
                            name="filePath"
                            value={file.path}
                          />
                          <input type="hidden" name="orgSlug" value={orgSlug} />
                          <Textarea
                            className="min-h-48 font-mono text-xs leading-6"
                            defaultValue={file.sharedContent}
                            name="sharedContent"
                            required
                          />
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                              Saving creates a new managed config version and
                              queues a runtime apply when the tenant runtime is
                              already ready.
                            </p>
                            <Button type="submit">Save and apply</Button>
                          </div>
                        </form>
                      </section>
                    </div>

                    <section className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-medium">
                          Effective file preview
                        </h2>
                        <Badge variant="outline">Projected to runtime</Badge>
                      </div>
                      <pre className="overflow-x-auto border border-border bg-background p-3 text-xs leading-6 whitespace-pre-wrap">
                        {file.renderedContent}
                      </pre>
                    </section>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
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

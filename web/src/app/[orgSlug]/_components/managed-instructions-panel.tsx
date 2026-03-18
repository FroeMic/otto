import { withAuth } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type DashboardOrganization,
  getLatestTenantManagedConfig,
  updateTenantManagedFileSharedContent,
} from "@/db/control-plane";
import { isManagedBootstrapFilePath } from "@/lib/openclaw/managed-config";
import { getPrimaryAgent } from "@/lib/workspace";

async function updateManagedInstructionAction(formData: FormData) {
  "use server";

  const { user } = await withAuth({ ensureSignedIn: true });
  const orgSlug = formData.get("orgSlug")?.toString();
  const filePath = formData.get("filePath")?.toString();
  const expectedVersionValue = formData.get("expectedVersion")?.toString();
  const sharedContent = formData.get("sharedContent")?.toString();

  if (!orgSlug || !filePath || !sharedContent) {
    throw new Error("Managed instruction update is missing required fields");
  }

  if (!isManagedBootstrapFilePath(filePath)) {
    throw new Error(`Unsupported managed instruction file: ${filePath}`);
  }

  await updateTenantManagedFileSharedContent({
    expectedVersion: expectedVersionValue
      ? Number.parseInt(expectedVersionValue, 10)
      : undefined,
    filePath,
    orgSlug,
    sharedContent,
    userExternalId: user.id,
  });

  revalidatePath(`/${orgSlug}/agent/prompts`);
}

type ManagedInstructionsPanelProps = {
  organization: DashboardOrganization;
  orgSlug: string;
};

export async function ManagedInstructionsPanel({
  organization,
  orgSlug,
}: ManagedInstructionsPanelProps) {
  const primaryAgent = getPrimaryAgent(organization);
  const managedConfig = primaryAgent
    ? await getLatestTenantManagedConfig(primaryAgent.id)
    : null;

  if (!primaryAgent || !managedConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Otto instructions</CardTitle>
          <CardDescription>
            These instruction files will appear once Otto has been set up for
            this workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
        <p>
          These files shape how Otto works in this workspace: how it should
          behave, how it should present itself, who it helps, and which local
          details matter.
        </p>
        <p>
          The protected section shows Otto&apos;s built-in starting point. The
          editable section is where you make it fit your team.
        </p>
      </div>

      <Tabs
        className="flex flex-col gap-4"
        defaultValue={managedConfig.files[0]?.path}
      >
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
          {managedConfig.files.map((file) => (
            <TabsTrigger key={file.path} value={file.path}>
              {file.path}
            </TabsTrigger>
          ))}
        </TabsList>

        {managedConfig.files.map((file) => (
          <TabsContent key={file.path} value={file.path}>
            <Card>
              <CardHeader>
                <CardTitle>{file.path}</CardTitle>
                <CardDescription>{file.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Collapsible className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-medium">
                        System instructions
                      </h2>
                      <Badge variant="outline">Protected</Badge>
                    </div>
                    <CollapsibleTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                      Show details
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="border border-border bg-muted/30 p-3">
                    <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
                      {file.systemContent}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>

                <form
                  action={updateManagedInstructionAction}
                  className="flex flex-col gap-3"
                >
                  <input
                    type="hidden"
                    name="expectedVersion"
                    value={managedConfig.version}
                  />
                  <input type="hidden" name="filePath" value={file.path} />
                  <input type="hidden" name="orgSlug" value={orgSlug} />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-medium">
                        Shared instructions
                      </h2>
                      <Badge variant="secondary">Editable</Badge>
                    </div>
                    <Textarea
                      className="min-h-40 font-mono text-xs leading-6"
                      defaultValue={file.sharedContent}
                      name="sharedContent"
                      required
                    />
                  </div>
                  <div className="flex items-center justify-end">
                    <Button type="submit">Save changes</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

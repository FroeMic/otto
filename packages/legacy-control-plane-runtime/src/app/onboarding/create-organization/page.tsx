import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { Button } from "../../../components/ui/button";
import { buttonVariants } from "../../../components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import {
  createWorkspaceOnboardingDraft,
  getDashboardOrganizations,
} from "../../../db/control-plane";

export const dynamic = "force-dynamic";

async function createOrganizationAction(formData: FormData) {
  "use server";

  const { user } = await withAuth({ ensureSignedIn: true });
  const workspaceName = formData.get("workspaceName")?.toString().trim();
  const workspaceSlug = formData.get("workspaceSlug")?.toString().trim();

  if (!workspaceName || !workspaceSlug) {
    throw new Error("Team name and team URL are required");
  }

  await createWorkspaceOnboardingDraft({
    workspaceName,
    workspaceSlug,
    user,
  });

  redirect("/");
}

export default async function CreateOrganizationPage() {
  const { user } = await withAuth({ ensureSignedIn: true });
  const organizations = await getDashboardOrganizations(user.id);

  if (organizations.length > 0) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>Set up your team workspace</CardTitle>
              <CardDescription>
                Start with the basics. Give your team a workspace and choose the
                short link you will use to come back here.
              </CardDescription>
            </div>
            <a
              className={buttonVariants({ size: "sm", variant: "ghost" })}
              href="/auth/sign-out"
            >
              Log out
            </a>
          </div>
        </CardHeader>
        <CardContent>
          <form
            action={createOrganizationAction}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="workspaceName" className="text-sm font-medium">
                Team name
              </label>
              <Input
                id="workspaceName"
                name="workspaceName"
                placeholder="Northstar Labs"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="workspaceSlug" className="text-sm font-medium">
                Team URL
              </label>
              <Input
                id="workspaceSlug"
                name="workspaceSlug"
                placeholder="northstar-labs"
                required
              />
              <p className="text-xs text-muted-foreground">
                This becomes your workspace URL: `app.../northstar-labs`
              </p>
            </div>
            <Button type="submit" size="lg" className="mt-2">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

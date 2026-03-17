import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PublicAuthShell } from "@/components/public-auth-shell";
import { buttonVariants } from "@/components/ui/button-variants";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const auth = await withAuth();

  if (auth.user) {
    redirect("/");
  }

  return (
    <PublicAuthShell
      subtitle="Invite-only access to the agent workspace, Slack setup, and runtime control plane."
      title="Your Team's Otto"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <a className={buttonVariants({ size: "lg" })} href="/auth/sign-in">
            Log in with WorkOS
          </a>
          <Link
            className={buttonVariants({ size: "lg", variant: "outline" })}
            href="/register"
          >
            Join the waitlist
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Already invited? Use your WorkOS account to continue where your team
          left off.
        </p>
      </div>
    </PublicAuthShell>
  );
}

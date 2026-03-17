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
      subtitle="Sign in to your Otto workspace, or create a new account and join the access queue for your team."
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
            Create your account
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Otto rolls out workspace by workspace, so account creation and access
          approval can happen on different timelines.
        </p>
      </div>
    </PublicAuthShell>
  );
}

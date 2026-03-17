import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PublicAuthShell } from "@/components/public-auth-shell";
import { buttonVariants } from "@/components/ui/button-variants";
import { WaitlistForm } from "@/components/waitlist-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const auth = await withAuth();

  if (auth.user) {
    redirect("/");
  }

  return (
    <PublicAuthShell
      subtitle="Create your account with WorkOS, then set up a workspace. If you would rather wait for a manual rollout, you can still leave your details below."
      title="Create your Otto workspace"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <a className={buttonVariants({ size: "lg" })} href="/auth/sign-up">
            Sign up with WorkOS
          </a>
          <p className="text-sm text-muted-foreground">
            Want to stay on the waitlist instead? Leave your details below.
          </p>
        </div>
        <WaitlistForm />
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="underline underline-offset-4" href="/login">
            Sign in
          </Link>
          .
        </p>
      </div>
    </PublicAuthShell>
  );
}

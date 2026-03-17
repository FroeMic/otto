import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const auth = await withAuth();

  if (auth.user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invite-only access</CardTitle>
          <CardDescription>
            Otto sign-up is currently limited to invited teams. Ask your Otto
            admin for an invitation before trying to create an account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Link className={buttonVariants({ size: "lg" })} href="/login">
            I already have an account
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            Need access? Contact the workspace owner who invited your team.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

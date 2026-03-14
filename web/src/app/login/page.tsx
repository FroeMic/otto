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

export default async function LoginPage() {
  const auth = await withAuth();

  if (auth.user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to Otto</CardTitle>
          <CardDescription>
            Your team agent lives here. Sign in to open Otto and continue where
            you left off.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <a className={buttonVariants({ size: "lg" })} href="/auth/sign-in">
            Continue
          </a>
          <Link
            className={buttonVariants({ size: "lg", variant: "outline" })}
            href="/register"
          >
            Create an account
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

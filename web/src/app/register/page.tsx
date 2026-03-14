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
          <CardTitle>Create your Otto</CardTitle>
          <CardDescription>
            Set up Otto for your team, connect Slack, and get your agent ready
            to work where your team already works.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <a className={buttonVariants({ size: "lg" })} href="/auth/sign-up">
            Continue
          </a>
          <Link
            className={buttonVariants({ size: "lg", variant: "outline" })}
            href="/login"
          >
            I already have an account
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

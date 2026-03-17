import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

import { PublicAuthShell } from "@/components/public-auth-shell";
import { WaitlistForm } from "@/components/waitlist-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const auth = await withAuth();

  if (auth.user) {
    redirect("/");
  }

  return (
    <PublicAuthShell
      subtitle="Otto sign-up is still invite-only, but you can leave your details here and we will reach out when access opens up for your setup."
      title="Join Otto early"
    >
      <WaitlistForm />
    </PublicAuthShell>
  );
}

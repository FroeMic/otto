import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyCapabilitiesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  redirect(`/${orgSlug}/capabilities2`);
}

import { redirect } from "next/navigation";

export default async function PlatformOrganizationIndexPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  redirect(`/platform/organizations/${orgSlug}/overview`);
}

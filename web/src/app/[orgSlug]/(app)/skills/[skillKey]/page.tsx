import { redirect } from "next/navigation";

import { buildManagedSkillSectionPath } from "@/lib/managed-skills/routing";

export const dynamic = "force-dynamic";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; skillKey: string }>;
}) {
  const { orgSlug, skillKey } = await params;
  redirect(
    buildManagedSkillSectionPath({
      orgSlug,
      section: "overview",
      skillKey,
    }),
  );
}

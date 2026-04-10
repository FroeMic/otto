import { withAuth } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { ManagedSkillDetailPanel } from "@/app/[orgSlug]/(app)/skills/_components/managed-skill-detail-panel";
import { updateTenantManagedSkillTextFile } from "@/db/control-plane";
import {
  getLatestTenantManagedSkillDetailForTenant,
  listTenantManagedSkillKeysForTenant,
} from "@/db/managed-skills";
import { listKnownManagedSkillDependencyIntegrationKeys } from "@/lib/managed-skills/package";
import { buildManagedSkillSectionPath } from "@/lib/managed-skills/routing";

async function updateManagedSkillAction(formData: FormData) {
  "use server";

  const { user } = await withAuth({ ensureSignedIn: true });
  const contentText = formData.get("contentText")?.toString();
  const expectedVersionValue = formData.get("expectedVersion")?.toString();
  const orgSlug = formData.get("orgSlug")?.toString();
  const relativePath = formData.get("relativePath")?.toString();
  const skillKey = formData.get("skillKey")?.toString();

  if (!orgSlug || !skillKey || !relativePath || contentText === undefined) {
    throw new Error("Managed skill update is missing required fields");
  }

  await updateTenantManagedSkillTextFile({
    contentText,
    expectedVersion: expectedVersionValue
      ? Number.parseInt(expectedVersionValue, 10)
      : undefined,
    orgSlug,
    relativePath,
    skillKey,
    userExternalId: user.id,
  });

  revalidatePath(`/${orgSlug}/skills`);
  revalidatePath(`/${orgSlug}/skills/${encodeURIComponent(skillKey)}`);
  revalidatePath(
    buildManagedSkillSectionPath({
      orgSlug,
      section: "overview",
      skillKey,
    }),
  );
  revalidatePath(
    buildManagedSkillSectionPath({
      orgSlug,
      section: "files",
      skillKey,
    }),
  );
  revalidatePath(
    buildManagedSkillSectionPath({
      orgSlug,
      section: "status",
      skillKey,
    }),
  );
}

export async function ManagedSkillPanel({
  orgSlug,
  section,
  skillKey,
  tenantId,
}: {
  orgSlug: string;
  section: "files" | "overview" | "status";
  skillKey: string;
  tenantId: string;
}) {
  const knownIntegrationKeys = listKnownManagedSkillDependencyIntegrationKeys();
  const knownSkillKeys = (
    await listTenantManagedSkillKeysForTenant({
      tenantId,
    })
  ).filter((knownSkillKey) => knownSkillKey !== skillKey);
  const detail = await getLatestTenantManagedSkillDetailForTenant({
    skillKey,
    tenantId,
  });

  if (!detail) {
    notFound();
  }

  return (
    <ManagedSkillDetailPanel
      detail={{
        ...detail,
        updatedAt: detail.updatedAt.toISOString(),
      }}
      knownIntegrationKeys={knownIntegrationKeys}
      knownSkillKeys={knownSkillKeys}
      orgSlug={orgSlug}
      section={section}
      updateAction={updateManagedSkillAction}
    />
  );
}

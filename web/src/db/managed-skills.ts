import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  tenantSkillFiles,
  tenantSkillFileVersions,
  tenantSkills,
  tenantSkillVersions,
} from "@/db/schema";
import {
  listKnownManagedSkillDependencyIntegrationKeys,
  type ManagedSkillPackageFileInput,
  type ManagedSkillSourceType,
  type ManagedSkillStatus,
  validateManagedSkillPackage,
} from "@/lib/managed-skills/package";

export async function createTenantManagedSkillForTenant(input: {
  createdByExternalId?: string | null;
  createdByType: "runtime" | "system" | "user";
  enabled?: boolean;
  files: ManagedSkillPackageFileInput[];
  skillKey: string;
  sourceType?: ManagedSkillSourceType;
  status?: ManagedSkillStatus;
  summary?: string;
  tenantId: string;
}) {
  const validated = validateManagedSkillPackage({
    files: input.files,
    knownIntegrationKeys: listKnownManagedSkillDependencyIntegrationKeys(),
    skillKey: input.skillKey,
  });

  const binaryManagedFiles = validated.files.filter(
    (file) => file.fileKind === "managed" && file.storageEncoding === "binary",
  );

  if (binaryManagedFiles.length > 0) {
    throw new Error(
      "Managed skill binary file storage is not implemented yet. Create the skill with text files only in the first slice.",
    );
  }

  const db = getDb();

  return db.transaction(async (tx) => {
    const [existingSkill] = await tx
      .select({
        id: tenantSkills.id,
      })
      .from(tenantSkills)
      .where(
        and(
          eq(tenantSkills.tenantId, input.tenantId),
          eq(tenantSkills.skillKey, validated.skillKey),
        ),
      )
      .limit(1);

    if (existingSkill) {
      throw new Error(
        `Managed skill ${validated.skillKey} already exists for this tenant.`,
      );
    }

    const [createdSkill] = await tx
      .insert(tenantSkills)
      .values({
        createdByExternalId: input.createdByExternalId ?? null,
        createdByType: input.createdByType,
        dependsOnJson: validated.dependencies,
        description: validated.description,
        displayName: validated.name,
        enabled: input.enabled ?? true,
        skillKey: validated.skillKey,
        sourceType: input.sourceType ?? "user",
        status: input.status ?? "ready",
        tenantId: input.tenantId,
        updatedByExternalId: input.createdByExternalId ?? null,
        updatedByType: input.createdByType,
      })
      .returning({
        id: tenantSkills.id,
        skillKey: tenantSkills.skillKey,
      });

    const [createdVersion] = await tx
      .insert(tenantSkillVersions)
      .values({
        createdByExternalId: input.createdByExternalId ?? null,
        createdByType: input.createdByType,
        summary: input.summary ?? `Created ${validated.skillKey}`,
        tenantSkillId: createdSkill.id,
        version: 1,
      })
      .returning({
        id: tenantSkillVersions.id,
        version: tenantSkillVersions.version,
      });

    const managedFiles = validated.files.filter(
      (file) => file.fileKind === "managed",
    );

    const insertedFiles = await tx
      .insert(tenantSkillFiles)
      .values(
        managedFiles.map((file) => ({
          contentEncoding: file.storageEncoding,
          contentSha256: file.contentSha256,
          contentType:
            file.contentType ??
            (file.storageEncoding === "utf8_text"
              ? "text/plain; charset=utf-8"
              : "application/octet-stream"),
          fileKind: file.fileKind,
          lastSeenAt: null,
          relativePath: file.path,
          tenantSkillId: createdSkill.id,
        })),
      )
      .returning({
        id: tenantSkillFiles.id,
        relativePath: tenantSkillFiles.relativePath,
      });

    const insertedFilesByPath = new Map(
      insertedFiles.map((file) => [file.relativePath, file.id]),
    );
    const managedTextFiles = managedFiles.filter(
      (file): file is (typeof managedFiles)[number] & { contentText: string } =>
        file.storageEncoding === "utf8_text" &&
        typeof file.contentText === "string",
    );

    if (managedTextFiles.length > 0) {
      await tx.insert(tenantSkillFileVersions).values(
        managedTextFiles.map((file) => ({
          contentSha256:
            file.contentSha256 ??
            (() => {
              throw new Error(`Missing checksum for managed file ${file.path}`);
            })(),
          contentText: file.contentText,
          createdByExternalId: input.createdByExternalId ?? null,
          createdByType: input.createdByType,
          tenantSkillFileId:
            insertedFilesByPath.get(file.path) ??
            (() => {
              throw new Error(`Inserted managed file missing for ${file.path}`);
            })(),
          tenantSkillVersionId: createdVersion.id,
          version: 1,
        })),
      );
    }

    return {
      dependencies: validated.dependencies,
      description: validated.description,
      displayName: validated.name,
      fileCount: managedFiles.length,
      skillId: createdSkill.id,
      skillKey: createdSkill.skillKey,
      version: createdVersion.version,
    };
  });
}

export async function listTenantManagedSkillsForTenant(input: {
  tenantId: string;
}) {
  const db = getDb();

  return db
    .select({
      description: tenantSkills.description,
      displayName: tenantSkills.displayName,
      enabled: tenantSkills.enabled,
      skillId: tenantSkills.id,
      skillKey: tenantSkills.skillKey,
      sourceType: tenantSkills.sourceType,
      status: tenantSkills.status,
      updatedAt: tenantSkills.updatedAt,
    })
    .from(tenantSkills)
    .where(eq(tenantSkills.tenantId, input.tenantId))
    .orderBy(desc(tenantSkills.updatedAt), tenantSkills.skillKey);
}

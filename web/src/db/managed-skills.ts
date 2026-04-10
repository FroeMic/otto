import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  tenantSkillFiles,
  tenantSkillFileVersions,
  tenantSkills,
  tenantSkillVersions,
} from "@/db/schema";
import {
  buildManagedSkillMarkdown,
  listKnownManagedSkillDependencyIntegrationKeys,
  MANAGED_SKILL_ENTRY_FILE_PATH,
  type ManagedSkillFileEditability,
  type ManagedSkillPackageFileInput,
  type ManagedSkillSourceType,
  type ManagedSkillStatus,
  normalizeManagedSkillKey,
  parseManagedSkillMarkdown,
  validateManagedSkillPackage,
} from "@/lib/managed-skills/package";
import { SYSTEM_MANAGED_SKILL_DEFINITIONS } from "@/lib/managed-skills/system-skills";

type DbExecutor = ReturnType<typeof getDb>;
type DbTransaction = Parameters<Parameters<DbExecutor["transaction"]>[0]>[0];

type ManagedSkillVersionMap = Record<string, number>;

export type ManagedSkillProjectedFile = {
  contents: string;
  relativePath: string;
  skillKey: string;
};

export type TenantManagedSkillDetail = {
  dependencies: {
    integrations: string[];
    skills: string[];
  };
  description: string;
  displayName: string;
  enabled: boolean;
  files: Array<{
    contentSha256: string | null;
    contentText: string | null;
    contentType: string | null;
    editability: ManagedSkillFileEditability;
    path: string;
    storageEncoding: "binary" | "utf8_text";
  }>;
  skillId: string;
  skillKey: string;
  sourceType: ManagedSkillSourceType;
  status: ManagedSkillStatus;
  summary: string | null;
  updatedAt: Date;
  version: number;
};

export type TenantManagedSkillPatch = {
  contentText?: string;
  description?: string;
  enabled?: boolean;
  integrationKeys?: string[];
  skillBody?: string;
  skillKeys?: string[];
};

export type TenantManagedSkillRenameResult = {
  changed: boolean;
  currentVersion: number;
  renamedFromSkillKey: string;
  skillKey: string;
};

export function rewriteManagedSkillDependencySkillKey(input: {
  contentText: string;
  fromSkillKey: string;
  toSkillKey: string;
}) {
  const fromSkillKey = normalizeManagedSkillKey(input.fromSkillKey);
  const toSkillKey = normalizeManagedSkillKey(input.toSkillKey);

  if (fromSkillKey === toSkillKey) {
    return input.contentText;
  }

  const current = parseManagedSkillMarkdown(input.contentText);

  if (!current.skillKeys.includes(fromSkillKey)) {
    return input.contentText;
  }

  return buildManagedSkillMarkdown({
    description: current.description,
    integrationKeys: current.integrationKeys,
    name: current.name,
    skillBody: current.skillBody,
    skillKeys: current.skillKeys.map((skillKey) =>
      skillKey === fromSkillKey ? toSkillKey : skillKey,
    ),
  });
}

export class ManagedSkillVersionConflictError extends Error {
  constructor(
    readonly expectedVersion: number,
    readonly currentVersion: number,
  ) {
    super(
      `Managed skill version mismatch: expected ${expectedVersion}, current ${currentVersion}`,
    );
  }
}

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
  const normalizedSkillKey = normalizeManagedSkillKey(input.skillKey);
  const db = getDb();

  return db.transaction(async (tx) => {
    await ensureTenantSystemManagedSkillsForTenantTx(tx, {
      tenantId: input.tenantId,
    });

    return createTenantManagedSkillForTenantTx(tx, {
      ...input,
      skillKey: normalizedSkillKey,
    });
  });
}

async function createTenantManagedSkillForTenantTx(
  tx: DbExecutor | DbTransaction,
  input: {
    createdByExternalId?: string | null;
    createdByType: "runtime" | "system" | "user";
    enabled?: boolean;
    files: ManagedSkillPackageFileInput[];
    skillKey: string;
    sourceType?: ManagedSkillSourceType;
    status?: ManagedSkillStatus;
    summary?: string;
    tenantId: string;
  },
) {
  const knownSkillKeys = await listTenantManagedSkillKeysForTenantTx(tx, {
    tenantId: input.tenantId,
  });
  const validated = validateManagedSkillPackage({
    files: input.files,
    knownIntegrationKeys: listKnownManagedSkillDependencyIntegrationKeys(),
    knownSkillKeys,
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

  assertManagedSkillDependencyGraphValid({
    dependencyMap: await listTenantManagedSkillDependencyGraphForTenantTx(tx, {
      tenantId: input.tenantId,
    }),
    nextDependencies: validated.dependencies.skills,
    skillKey: validated.skillKey,
  });

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
}

export async function listTenantManagedSkillsForTenant(input: {
  tenantId: string;
}) {
  const db = getDb();

  await ensureTenantSystemManagedSkillsForTenantTx(db, {
    tenantId: input.tenantId,
  });

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

export async function listTenantManagedSkillKeysForTenant(input: {
  tenantId: string;
}) {
  const db = getDb();

  await ensureTenantSystemManagedSkillsForTenantTx(db, input);

  return await listTenantManagedSkillKeysForTenantTx(db, input);
}

export async function listTenantManagedSkillKeysForTenantTx(
  tx: DbExecutor | DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const rows = await tx
    .select({
      skillKey: tenantSkills.skillKey,
    })
    .from(tenantSkills)
    .where(eq(tenantSkills.tenantId, input.tenantId))
    .orderBy(tenantSkills.skillKey);

  return rows.map((row) => row.skillKey);
}

export async function listLatestTenantManagedSkillVersionMapForTenant(input: {
  tenantId: string;
}) {
  const db = getDb();

  await ensureTenantSystemManagedSkillsForTenantTx(db, input);

  return await listLatestTenantManagedSkillVersionMapTx(db, input);
}

export async function listProjectedManagedSkillFilesForTenant(input: {
  tenantId: string;
  versionMap?: ManagedSkillVersionMap | null;
}) {
  const db = getDb();

  await ensureTenantSystemManagedSkillsForTenantTx(db, {
    tenantId: input.tenantId,
  });

  return await listProjectedManagedSkillFilesTx(db, input);
}

export async function listLatestTenantManagedSkillVersionMapTx(
  tx: DbExecutor | DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const skillRows = await tx
    .select({
      skillId: tenantSkills.id,
      skillKey: tenantSkills.skillKey,
    })
    .from(tenantSkills)
    .where(
      and(
        eq(tenantSkills.tenantId, input.tenantId),
        eq(tenantSkills.enabled, true),
      ),
    )
    .orderBy(tenantSkills.skillKey);

  const versionMap: ManagedSkillVersionMap = {};

  for (const skill of skillRows) {
    const [latestVersion] = await tx
      .select({
        version: tenantSkillVersions.version,
      })
      .from(tenantSkillVersions)
      .where(eq(tenantSkillVersions.tenantSkillId, skill.skillId))
      .orderBy(desc(tenantSkillVersions.version))
      .limit(1);

    if (latestVersion?.version) {
      versionMap[skill.skillKey] = latestVersion.version;
    }
  }

  return versionMap;
}

export async function listProjectedManagedSkillFilesTx(
  tx: DbExecutor | DbTransaction,
  input: {
    tenantId: string;
    versionMap?: ManagedSkillVersionMap | null;
  },
) {
  const versionMap =
    input.versionMap ??
    (await listLatestTenantManagedSkillVersionMapTx(tx, input));
  const entries = Object.entries(versionMap).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  if (entries.length === 0) {
    return [] satisfies ManagedSkillProjectedFile[];
  }

  const projectedFiles: ManagedSkillProjectedFile[] = [];

  for (const [skillKey, version] of entries) {
    const [skill] = await tx
      .select({
        skillId: tenantSkills.id,
        skillKey: tenantSkills.skillKey,
      })
      .from(tenantSkills)
      .where(
        and(
          eq(tenantSkills.tenantId, input.tenantId),
          eq(tenantSkills.skillKey, skillKey),
          eq(tenantSkills.enabled, true),
        ),
      )
      .limit(1);

    if (!skill) {
      throw new Error(
        `Managed skill ${skillKey} is missing for tenant ${input.tenantId}.`,
      );
    }

    const [skillVersion] = await tx
      .select({
        id: tenantSkillVersions.id,
      })
      .from(tenantSkillVersions)
      .where(
        and(
          eq(tenantSkillVersions.tenantSkillId, skill.skillId),
          eq(tenantSkillVersions.version, version),
        ),
      )
      .limit(1);

    if (!skillVersion) {
      throw new Error(
        `Managed skill ${skillKey} does not have version ${version}.`,
      );
    }

    const fileRows = await tx
      .select({
        contentEncoding: tenantSkillFiles.contentEncoding,
        contentText: tenantSkillFileVersions.contentText,
        relativePath: tenantSkillFiles.relativePath,
      })
      .from(tenantSkillFileVersions)
      .innerJoin(
        tenantSkillFiles,
        eq(tenantSkillFiles.id, tenantSkillFileVersions.tenantSkillFileId),
      )
      .where(eq(tenantSkillFileVersions.tenantSkillVersionId, skillVersion.id))
      .orderBy(tenantSkillFiles.relativePath);

    for (const file of fileRows) {
      if (file.contentEncoding !== "utf8_text") {
        throw new Error(
          `Managed skill ${skillKey} includes non-text file ${file.relativePath}, which cannot be projected yet.`,
        );
      }

      projectedFiles.push({
        contents: file.contentText,
        relativePath: `skills/${skillKey}/${file.relativePath}`,
        skillKey,
      });
    }
  }

  return projectedFiles;
}

export async function getLatestTenantManagedSkillDetailForTenant(input: {
  skillKey: string;
  tenantId: string;
}) {
  const db = getDb();

  await ensureTenantSystemManagedSkillsForTenantTx(db, {
    tenantId: input.tenantId,
  });

  return await getLatestTenantManagedSkillDetailForTenantTx(db, input);
}

export async function getLatestTenantManagedSkillDetailForTenantTx(
  tx: DbExecutor | DbTransaction,
  input: {
    skillKey: string;
    tenantId: string;
  },
): Promise<TenantManagedSkillDetail | null> {
  const [skill] = await tx
    .select({
      dependsOnJson: tenantSkills.dependsOnJson,
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
    .where(
      and(
        eq(tenantSkills.tenantId, input.tenantId),
        eq(tenantSkills.skillKey, input.skillKey),
      ),
    )
    .limit(1);

  if (!skill) {
    return null;
  }

  const [latestVersion] = await tx
    .select({
      id: tenantSkillVersions.id,
      summary: tenantSkillVersions.summary,
      version: tenantSkillVersions.version,
    })
    .from(tenantSkillVersions)
    .where(eq(tenantSkillVersions.tenantSkillId, skill.skillId))
    .orderBy(desc(tenantSkillVersions.version))
    .limit(1);

  if (!latestVersion) {
    throw new Error(
      `Managed skill ${input.skillKey} has no stored versions for tenant ${input.tenantId}.`,
    );
  }

  const fileRows = await tx
    .select({
      contentEncoding: tenantSkillFiles.contentEncoding,
      contentSha256: tenantSkillFiles.contentSha256,
      contentText: tenantSkillFileVersions.contentText,
      contentType: tenantSkillFiles.contentType,
      relativePath: tenantSkillFiles.relativePath,
    })
    .from(tenantSkillFileVersions)
    .innerJoin(
      tenantSkillFiles,
      eq(tenantSkillFiles.id, tenantSkillFileVersions.tenantSkillFileId),
    )
    .where(eq(tenantSkillFileVersions.tenantSkillVersionId, latestVersion.id))
    .orderBy(tenantSkillFiles.relativePath);

  return {
    dependencies: normalizeManagedSkillDependencies(skill.dependsOnJson),
    description: skill.description,
    displayName: skill.displayName,
    enabled: skill.enabled,
    files: fileRows.map((file) => ({
      contentSha256: file.contentSha256,
      contentText: file.contentText,
      contentType: file.contentType,
      editability:
        file.contentEncoding === "utf8_text" &&
        file.relativePath === MANAGED_SKILL_ENTRY_FILE_PATH &&
        skill.sourceType !== "system"
          ? "editable"
          : "download_only",
      path: file.relativePath,
      storageEncoding:
        file.contentEncoding === "utf8_text" ? "utf8_text" : "binary",
    })),
    skillId: skill.skillId,
    skillKey: skill.skillKey,
    sourceType: normalizeManagedSkillSourceType(skill.sourceType),
    status: normalizeManagedSkillStatus(skill.status),
    summary: latestVersion.summary,
    updatedAt: skill.updatedAt,
    version: latestVersion.version,
  };
}

export async function updateTenantManagedSkillTextFileForTenantTx(
  tx: DbExecutor | DbTransaction,
  input: {
    contentText: string;
    createdByExternalId?: string | null;
    createdByType: "runtime" | "system" | "user";
    expectedVersion?: number;
    relativePath: string;
    skillKey: string;
    summary?: string;
    tenantId: string;
  },
) {
  const detail = await getLatestTenantManagedSkillDetailForTenantTx(tx, {
    skillKey: input.skillKey,
    tenantId: input.tenantId,
  });

  if (!detail) {
    throw new Error(
      `Managed skill ${input.skillKey} does not exist for this workspace.`,
    );
  }

  if (
    input.expectedVersion !== undefined &&
    detail.version !== input.expectedVersion
  ) {
    throw new ManagedSkillVersionConflictError(
      input.expectedVersion,
      detail.version,
    );
  }

  const normalizedPath = input.relativePath.trim().replaceAll("\\", "/");

  if (detail.sourceType === "system" && input.createdByType !== "system") {
    throw new Error(
      "System-managed skills cannot be edited through the managed-skills surface.",
    );
  }

  if (normalizedPath !== MANAGED_SKILL_ENTRY_FILE_PATH) {
    throw new Error(
      "Only SKILL.md can be edited through the managed-skills surface.",
    );
  }

  const targetFile = detail.files.find((file) => file.path === normalizedPath);

  if (!targetFile) {
    throw new Error(
      `Managed skill file ${normalizedPath} does not exist in ${detail.skillKey}.`,
    );
  }

  if (targetFile.storageEncoding !== "utf8_text") {
    throw new Error(`Managed skill file ${normalizedPath} is not editable.`);
  }

  if (targetFile.contentText === input.contentText) {
    return {
      changed: false,
      currentVersion: detail.version,
      skillKey: detail.skillKey,
    };
  }

  const nextPackageFiles: ManagedSkillPackageFileInput[] = detail.files.map(
    (file) => ({
      contentText:
        file.path === normalizedPath ? input.contentText : file.contentText,
      contentType: file.contentType,
      path: file.path,
    }),
  );
  const validated = validateManagedSkillPackage({
    files: nextPackageFiles,
    knownIntegrationKeys: listKnownManagedSkillDependencyIntegrationKeys(),
    knownSkillKeys: await listTenantManagedSkillKeysForTenantTx(tx, {
      tenantId: input.tenantId,
    }),
    skillKey: detail.skillKey,
  });
  assertManagedSkillDependencyGraphValid({
    dependencyMap: await listTenantManagedSkillDependencyGraphForTenantTx(tx, {
      tenantId: input.tenantId,
    }),
    nextDependencies: validated.dependencies.skills,
    skillKey: detail.skillKey,
  });
  const managedFileRows = await tx
    .select({
      contentType: tenantSkillFiles.contentType,
      fileId: tenantSkillFiles.id,
      relativePath: tenantSkillFiles.relativePath,
    })
    .from(tenantSkillFiles)
    .where(eq(tenantSkillFiles.tenantSkillId, detail.skillId))
    .orderBy(tenantSkillFiles.relativePath);
  const fileIdByPath = new Map(
    managedFileRows.map((file) => [file.relativePath, file.fileId]),
  );
  const [createdVersion] = await tx
    .insert(tenantSkillVersions)
    .values({
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      summary: input.summary ?? `Updated ${detail.skillKey}/${normalizedPath}`,
      tenantSkillId: detail.skillId,
      version: detail.version + 1,
    })
    .returning({
      id: tenantSkillVersions.id,
      version: tenantSkillVersions.version,
    });

  for (const file of validated.files) {
    const fileId = fileIdByPath.get(file.path);

    if (!fileId) {
      throw new Error(
        `Managed skill file metadata is missing for ${detail.skillKey}/${file.path}.`,
      );
    }

    await tx
      .update(tenantSkillFiles)
      .set({
        contentEncoding: file.storageEncoding,
        contentSha256: file.contentSha256,
        contentType:
          file.contentType ??
          (file.storageEncoding === "utf8_text"
            ? "text/markdown; charset=utf-8"
            : "application/octet-stream"),
        updatedAt: new Date(),
      })
      .where(eq(tenantSkillFiles.id, fileId));

    if (
      file.storageEncoding !== "utf8_text" ||
      typeof file.contentText !== "string"
    ) {
      throw new Error(
        `Managed skill file ${detail.skillKey}/${file.path} cannot be versioned as non-text in the current slice.`,
      );
    }

    await tx.insert(tenantSkillFileVersions).values({
      contentSha256:
        file.contentSha256 ??
        (() => {
          throw new Error(`Missing checksum for managed file ${file.path}`);
        })(),
      contentText: file.contentText,
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      tenantSkillFileId: fileId,
      tenantSkillVersionId: createdVersion.id,
      version: createdVersion.version,
    });
  }

  await tx
    .update(tenantSkills)
    .set({
      dependsOnJson: validated.dependencies,
      description: validated.description,
      displayName: validated.name,
      status: "ready",
      updatedAt: new Date(),
      updatedByExternalId: input.createdByExternalId ?? null,
      updatedByType: input.createdByType,
    })
    .where(eq(tenantSkills.id, detail.skillId));

  return {
    changed: true,
    currentVersion: createdVersion.version,
    dependencies: validated.dependencies,
    description: validated.description,
    displayName: validated.name,
    skillKey: detail.skillKey,
  };
}

export async function updateTenantManagedSkillForTenantTx(
  tx: DbExecutor | DbTransaction,
  input: {
    createdByExternalId?: string | null;
    createdByType: "runtime" | "system" | "user";
    expectedVersion?: number;
    patch: TenantManagedSkillPatch;
    skillKey: string;
    summary?: string;
    tenantId: string;
  },
) {
  const detail = await getLatestTenantManagedSkillDetailForTenantTx(tx, {
    skillKey: input.skillKey,
    tenantId: input.tenantId,
  });

  if (!detail) {
    throw new Error(
      `Managed skill ${input.skillKey} does not exist for this workspace.`,
    );
  }

  if (
    input.expectedVersion !== undefined &&
    detail.version !== input.expectedVersion
  ) {
    throw new ManagedSkillVersionConflictError(
      input.expectedVersion,
      detail.version,
    );
  }

  if (detail.sourceType === "system" && input.createdByType !== "system") {
    throw new Error(
      "System-managed skills cannot be edited through the managed-skills surface.",
    );
  }

  const currentContent = getManagedSkillEntryContent(detail);
  const nextContent = buildNextManagedSkillContent({
    currentContent,
    patch: input.patch,
  });

  let changed = false;
  let currentVersion = detail.version;

  if (nextContent !== currentContent) {
    const updatedSkill = await updateTenantManagedSkillTextFileForTenantTx(tx, {
      contentText: nextContent,
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      expectedVersion: currentVersion,
      relativePath: MANAGED_SKILL_ENTRY_FILE_PATH,
      skillKey: detail.skillKey,
      summary: input.summary,
      tenantId: input.tenantId,
    });

    changed = changed || updatedSkill.changed;
    currentVersion = updatedSkill.currentVersion;
  }

  const nextEnabled = input.patch.enabled ?? detail.enabled;

  if (nextEnabled !== detail.enabled) {
    await tx
      .update(tenantSkills)
      .set({
        enabled: nextEnabled,
        status: nextEnabled ? "ready" : "disabled",
        updatedAt: new Date(),
        updatedByExternalId: input.createdByExternalId ?? null,
        updatedByType: input.createdByType,
      })
      .where(eq(tenantSkills.id, detail.skillId));

    changed = true;
  }

  return {
    changed,
    currentVersion,
    enabled: nextEnabled,
    skillKey: detail.skillKey,
  };
}

export async function renameTenantManagedSkillForTenantTx(
  tx: DbExecutor | DbTransaction,
  input: {
    createdByExternalId?: string | null;
    createdByType: "runtime" | "user";
    expectedVersion?: number;
    newSkillKey: string;
    skillKey: string;
    summary?: string;
    tenantId: string;
  },
): Promise<TenantManagedSkillRenameResult> {
  const detail = await getLatestTenantManagedSkillDetailForTenantTx(tx, {
    skillKey: input.skillKey,
    tenantId: input.tenantId,
  });

  if (!detail) {
    throw new Error(
      `Managed skill ${input.skillKey} does not exist for this workspace.`,
    );
  }

  if (
    input.expectedVersion !== undefined &&
    detail.version !== input.expectedVersion
  ) {
    throw new ManagedSkillVersionConflictError(
      input.expectedVersion,
      detail.version,
    );
  }

  if (detail.sourceType !== "user") {
    throw new Error(
      "Only workspace-managed skills can be renamed through this surface.",
    );
  }

  const nextSkillKey = normalizeManagedSkillKey(input.newSkillKey);

  if (nextSkillKey === detail.skillKey) {
    return {
      changed: false,
      currentVersion: detail.version,
      renamedFromSkillKey: detail.skillKey,
      skillKey: detail.skillKey,
    };
  }

  const [existingSkill] = await tx
    .select({
      id: tenantSkills.id,
    })
    .from(tenantSkills)
    .where(
      and(
        eq(tenantSkills.tenantId, input.tenantId),
        eq(tenantSkills.skillKey, nextSkillKey),
      ),
    )
    .limit(1);

  if (existingSkill) {
    throw new Error(
      `Managed skill ${nextSkillKey} already exists for this tenant.`,
    );
  }

  const dependencyRows = await tx
    .select({
      skillKey: tenantSkills.skillKey,
    })
    .from(tenantSkills)
    .where(eq(tenantSkills.tenantId, input.tenantId))
    .orderBy(tenantSkills.skillKey);

  const dependentUpdates: Array<{
    contentText: string;
    currentVersion: number;
    skillKey: string;
  }> = [];

  for (const row of dependencyRows) {
    if (row.skillKey === detail.skillKey) {
      continue;
    }

    const dependencyDetail = await getLatestTenantManagedSkillDetailForTenantTx(
      tx,
      {
        skillKey: row.skillKey,
        tenantId: input.tenantId,
      },
    );

    if (!dependencyDetail) {
      continue;
    }

    const currentContent = getManagedSkillEntryContent(dependencyDetail);
    const nextContent = rewriteManagedSkillDependencySkillKey({
      contentText: currentContent,
      fromSkillKey: detail.skillKey,
      toSkillKey: nextSkillKey,
    });

    if (nextContent === currentContent) {
      continue;
    }

    dependentUpdates.push({
      contentText: nextContent,
      currentVersion: dependencyDetail.version,
      skillKey: dependencyDetail.skillKey,
    });
  }

  await tx
    .update(tenantSkills)
    .set({
      skillKey: nextSkillKey,
      updatedAt: new Date(),
      updatedByExternalId: input.createdByExternalId ?? null,
      updatedByType: input.createdByType,
    })
    .where(eq(tenantSkills.id, detail.skillId));

  const currentVersion = await createTenantManagedSkillVersionSnapshotTx(tx, {
    createdByExternalId: input.createdByExternalId ?? null,
    createdByType: input.createdByType,
    detail: {
      ...detail,
      skillKey: nextSkillKey,
    },
    summary:
      input.summary ?? `Renamed ${detail.skillKey} to ${nextSkillKey}`,
  });

  for (const dependencyUpdate of dependentUpdates) {
    await updateTenantManagedSkillTextFileForTenantTx(tx, {
      contentText: dependencyUpdate.contentText,
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      expectedVersion: dependencyUpdate.currentVersion,
      relativePath: MANAGED_SKILL_ENTRY_FILE_PATH,
      skillKey: dependencyUpdate.skillKey,
      summary: `Updated ${dependencyUpdate.skillKey} after renaming ${detail.skillKey} to ${nextSkillKey}`,
      tenantId: input.tenantId,
    });
  }

  return {
    changed: true,
    currentVersion,
    renamedFromSkillKey: detail.skillKey,
    skillKey: nextSkillKey,
  };
}

export async function deleteTenantManagedSkillForTenantTx(
  tx: DbExecutor | DbTransaction,
  input: {
    createdByType: "runtime" | "system" | "user";
    expectedVersion?: number;
    skillKey: string;
    tenantId: string;
  },
) {
  const detail = await getLatestTenantManagedSkillDetailForTenantTx(tx, {
    skillKey: input.skillKey,
    tenantId: input.tenantId,
  });

  if (!detail) {
    throw new Error(
      `Managed skill ${input.skillKey} does not exist for this workspace.`,
    );
  }

  if (
    input.expectedVersion !== undefined &&
    detail.version !== input.expectedVersion
  ) {
    throw new ManagedSkillVersionConflictError(
      input.expectedVersion,
      detail.version,
    );
  }

  if (detail.sourceType === "system" && input.createdByType !== "system") {
    throw new Error(
      "System-managed skills cannot be deleted through the managed-skills surface.",
    );
  }

  await tx.delete(tenantSkills).where(eq(tenantSkills.id, detail.skillId));

  return {
    deleted: true,
    skillKey: detail.skillKey,
  };
}

function normalizeManagedSkillDependencies(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      integrations: [],
      skills: [],
    };
  }

  const integrations = Array.isArray(
    (value as { integrations?: unknown }).integrations,
  )
    ? (value as { integrations: unknown[] }).integrations.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const skills = Array.isArray((value as { skills?: unknown }).skills)
    ? (value as { skills: unknown[] }).skills.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];

  return {
    integrations: [...new Set(integrations)].sort((left, right) =>
      left.localeCompare(right),
    ),
    skills: [...new Set(skills)].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

async function listTenantManagedSkillDependencyGraphForTenantTx(
  tx: DbExecutor | DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const rows = await tx
    .select({
      dependsOnJson: tenantSkills.dependsOnJson,
      skillKey: tenantSkills.skillKey,
    })
    .from(tenantSkills)
    .where(eq(tenantSkills.tenantId, input.tenantId))
    .orderBy(tenantSkills.skillKey);

  return Object.fromEntries(
    rows.map((row) => [
      row.skillKey,
      normalizeManagedSkillDependencies(row.dependsOnJson).skills,
    ]),
  ) satisfies Record<string, string[]>;
}

export function assertManagedSkillDependencyGraphValid(input: {
  dependencyMap: Record<string, string[]>;
  nextDependencies: string[];
  skillKey: string;
}) {
  const graph: Record<string, string[]> = {
    ...input.dependencyMap,
    [input.skillKey]: [...new Set(input.nextDependencies)].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(skillKey: string, stack: string[]) {
    if (visiting.has(skillKey)) {
      const cycleStartIndex = stack.indexOf(skillKey);
      const cyclePath = [...stack.slice(cycleStartIndex), skillKey].join(
        " -> ",
      );
      throw new Error(`Managed skill dependency cycle detected: ${cyclePath}`);
    }

    if (visited.has(skillKey)) {
      return;
    }

    visiting.add(skillKey);
    const nextStack = [...stack, skillKey];

    for (const dependencySkillKey of graph[skillKey] ?? []) {
      visit(dependencySkillKey, nextStack);
    }

    visiting.delete(skillKey);
    visited.add(skillKey);
  }

  visit(input.skillKey, []);
}

function normalizeManagedSkillSourceType(
  value: string,
): ManagedSkillSourceType {
  return value === "integration_contribution"
    ? "integration_contribution"
    : value === "system"
      ? "system"
      : "user";
}

export async function ensureTenantSystemManagedSkillsForTenant(input: {
  tenantId: string;
}) {
  const db = getDb();

  await db.transaction(async (tx) => {
    await ensureTenantSystemManagedSkillsForTenantTx(tx, input);
  });
}

export async function ensureTenantSystemManagedSkillsForTenantTx(
  tx: DbExecutor | DbTransaction,
  input: {
    tenantId: string;
  },
) {
  for (const definition of SYSTEM_MANAGED_SKILL_DEFINITIONS) {
    const detail = await getLatestTenantManagedSkillDetailForTenantTx(tx, {
      skillKey: definition.skillKey,
      tenantId: input.tenantId,
    });

    if (!detail) {
      await createTenantManagedSkillForTenantTx(tx, {
        createdByType: "system",
        files: [
          {
            contentText: definition.contentText,
            path: MANAGED_SKILL_ENTRY_FILE_PATH,
          },
        ],
        skillKey: definition.skillKey,
        sourceType: "system",
        status: "ready",
        summary: definition.summary,
        tenantId: input.tenantId,
      });
      continue;
    }

    if (detail.sourceType !== "system") {
      continue;
    }

    const currentSkillFile = detail.files.find(
      (file) => file.path === MANAGED_SKILL_ENTRY_FILE_PATH,
    );

    if (currentSkillFile?.contentText === definition.contentText) {
      continue;
    }

    await updateTenantManagedSkillTextFileForTenantTx(tx, {
      contentText: definition.contentText,
      createdByType: "system",
      expectedVersion: detail.version,
      relativePath: MANAGED_SKILL_ENTRY_FILE_PATH,
      skillKey: definition.skillKey,
      summary: definition.summary,
      tenantId: input.tenantId,
    });
  }
}

function normalizeManagedSkillStatus(value: string): ManagedSkillStatus {
  switch (value) {
    case "disabled":
    case "invalid":
    case "missing_prerequisite":
    case "projection_failed":
    case "ready":
      return value;
    default:
      return "invalid";
  }
}

function getManagedSkillEntryContent(detail: TenantManagedSkillDetail) {
  const entryFile = detail.files.find(
    (file) => file.path === MANAGED_SKILL_ENTRY_FILE_PATH,
  );

  if (
    !entryFile ||
    entryFile.storageEncoding !== "utf8_text" ||
    typeof entryFile.contentText !== "string"
  ) {
    throw new Error(
      `Managed skill ${detail.skillKey} is missing a readable SKILL.md entry file.`,
    );
  }

  return entryFile.contentText;
}

async function createTenantManagedSkillVersionSnapshotTx(
  tx: DbExecutor | DbTransaction,
  input: {
    createdByExternalId?: string | null;
    createdByType: "runtime" | "user";
    detail: TenantManagedSkillDetail;
    summary: string;
  },
) {
  const [createdVersion] = await tx
    .insert(tenantSkillVersions)
    .values({
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      summary: input.summary,
      tenantSkillId: input.detail.skillId,
      version: input.detail.version + 1,
    })
    .returning({
      id: tenantSkillVersions.id,
      version: tenantSkillVersions.version,
    });

  const managedFileRows = await tx
    .select({
      fileId: tenantSkillFiles.id,
      relativePath: tenantSkillFiles.relativePath,
    })
    .from(tenantSkillFiles)
    .where(eq(tenantSkillFiles.tenantSkillId, input.detail.skillId))
    .orderBy(tenantSkillFiles.relativePath);
  const detailFileByPath = new Map(
    input.detail.files.map((file) => [file.path, file]),
  );

  for (const managedFileRow of managedFileRows) {
    const detailFile = detailFileByPath.get(managedFileRow.relativePath);

    if (
      !detailFile ||
      detailFile.storageEncoding !== "utf8_text" ||
      typeof detailFile.contentText !== "string"
    ) {
      throw new Error(
        `Managed skill file ${input.detail.skillKey}/${managedFileRow.relativePath} cannot be versioned as non-text in the current slice.`,
      );
    }

    await tx.insert(tenantSkillFileVersions).values({
      contentSha256:
        detailFile.contentSha256 ??
        (() => {
          throw new Error(
            `Missing checksum for managed file ${managedFileRow.relativePath}`,
          );
        })(),
      contentText: detailFile.contentText,
      createdByExternalId: input.createdByExternalId ?? null,
      createdByType: input.createdByType,
      tenantSkillFileId: managedFileRow.fileId,
      tenantSkillVersionId: createdVersion.id,
      version: createdVersion.version,
    });
  }

  return createdVersion.version;
}

function buildNextManagedSkillContent(input: {
  currentContent: string;
  patch: TenantManagedSkillPatch;
}) {
  const hasStructuredPatch =
    typeof input.patch.description === "string" ||
    typeof input.patch.skillBody === "string" ||
    Array.isArray(input.patch.integrationKeys) ||
    Array.isArray(input.patch.skillKeys);

  if (typeof input.patch.contentText === "string" && hasStructuredPatch) {
    throw new Error(
      "contentText cannot be combined with structured managed skill patch fields.",
    );
  }

  if (typeof input.patch.contentText === "string") {
    return input.patch.contentText;
  }

  if (!hasStructuredPatch) {
    return input.currentContent;
  }

  const current = parseManagedSkillMarkdown(input.currentContent);

  return buildManagedSkillMarkdown({
    description: input.patch.description ?? current.description,
    integrationKeys: input.patch.integrationKeys ?? current.integrationKeys,
    name: current.name,
    skillBody: input.patch.skillBody ?? current.skillBody,
    skillKeys: input.patch.skillKeys ?? current.skillKeys,
  });
}

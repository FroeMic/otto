import * as z from "zod"

export const workspaceSkillOriginSchema = z.enum(["custom", "from_library"])

export const workspaceSkillStatusSchema = z.enum([
  "disabled",
  "invalid",
  "missing_prerequisite",
  "projection_failed",
  "ready",
])

export const workspaceSkillFileSchema = z.object({
  contentSha256: z.string().nullable(),
  contentText: z.string().nullable(),
  contentType: z.string().nullable(),
  editability: z.enum(["download_only", "editable", "local_state"]),
  fileClass: z.enum(["managed_entry", "managed_seeded"]),
  path: z.string().min(1),
  resettable: z.boolean(),
  storageEncoding: z.enum(["binary", "utf8_text"]),
})

export const workspaceSkillDependencySummarySchema = z.object({
  integrations: z.array(z.string()),
  skills: z.array(z.string()),
})

export const workspaceInstalledSkillListEntrySchema = z.object({
  description: z.string(),
  displayName: z.string(),
  editable: z.boolean(),
  enabled: z.boolean(),
  origin: workspaceSkillOriginSchema,
  removable: z.boolean(),
  resettable: z.boolean(),
  skillKey: z.string().min(1),
  status: workspaceSkillStatusSchema,
  updatedAt: z.string(),
})

export type WorkspaceInstalledSkillListEntry = z.infer<
  typeof workspaceInstalledSkillListEntrySchema
>

export const workspaceSkillLibraryEntrySchema = z.object({
  dependencies: workspaceSkillDependencySummarySchema,
  description: z.string(),
  displayName: z.string(),
  installable: z.boolean(),
  installed: z.boolean(),
  skillKey: z.string().min(1),
  summary: z.string(),
})

export type WorkspaceSkillLibraryEntry = z.infer<
  typeof workspaceSkillLibraryEntrySchema
>

export const workspaceSkillsListResponseSchema = z.object({
  installedSkills: z.array(workspaceInstalledSkillListEntrySchema),
  knownIntegrationKeys: z.array(z.string()),
  librarySkills: z.array(workspaceSkillLibraryEntrySchema),
  state: z.enum(["pending_setup", "ready"]),
})

export type WorkspaceSkillsListResponse = z.infer<
  typeof workspaceSkillsListResponseSchema
>

export const workspaceSkillSectionSchema = z.enum([
  "files",
  "instructions",
  "overview",
])

export type WorkspaceSkillSection = z.infer<
  typeof workspaceSkillSectionSchema
>

export const workspaceSkillDetailSchema = z.object({
  dependencies: workspaceSkillDependencySummarySchema,
  description: z.string(),
  displayName: z.string(),
  editable: z.boolean(),
  files: z.array(workspaceSkillFileSchema),
  origin: workspaceSkillOriginSchema,
  removable: z.boolean(),
  skillKey: z.string().min(1),
  status: workspaceSkillStatusSchema,
  summary: z.string().nullable(),
  updatedAt: z.string(),
  version: z.number().int().positive(),
})

export type WorkspaceSkillDetail = z.infer<typeof workspaceSkillDetailSchema>

export const workspaceSkillDetailResponseSchema = z.object({
  availableSections: z.array(workspaceSkillSectionSchema),
  detail: workspaceSkillDetailSchema.nullable(),
  knownIntegrationKeys: z.array(z.string()),
  knownSkillKeys: z.array(z.string()),
  state: z.enum(["pending_setup", "ready"]),
})

export type WorkspaceSkillDetailResponse = z.infer<
  typeof workspaceSkillDetailResponseSchema
>

export const workspaceSkillCreateRequestSchema = z.object({
  description: z.string().trim().min(1),
  integrationKeys: z.array(z.string().trim().min(1)).default([]),
  name: z.string().trim().min(1),
  skillBody: z.string().trim().min(1),
  skillKey: z.string().trim().min(1),
  skillKeys: z.array(z.string().trim().min(1)).default([]),
})

export const workspaceSkillMutationResponseSchema = z.object({
  applyQueued: z.boolean(),
  changed: z.boolean().optional(),
  currentVersion: z.number().int().positive().optional(),
  desiredStateVersion: z.number().int().positive(),
  skillKey: z.string().min(1),
  version: z.number().int().positive().optional(),
})

export type WorkspaceSkillMutationResponse = z.infer<
  typeof workspaceSkillMutationResponseSchema
>

export const workspaceSkillDeleteRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
})

export const workspaceSkillDeleteResponseSchema = z.object({
  applyQueued: z.boolean(),
  deleted: z.boolean(),
  desiredStateVersion: z.number().int().positive(),
  skillKey: z.string().min(1),
})

export type WorkspaceSkillDeleteResponse = z.infer<
  typeof workspaceSkillDeleteResponseSchema
>

export const workspaceSkillUpdateRequestSchema = z.object({
  description: z.string().trim().min(1),
  expectedVersion: z.number().int().positive().optional(),
  integrationKeys: z.array(z.string().trim().min(1)).default([]),
  name: z.string().trim().min(1),
  skillBody: z.string().trim().min(1),
  skillKeys: z.array(z.string().trim().min(1)).default([]),
})

export const workspaceSkillResetScopeSchema = z.enum(["companion_files"])

export type WorkspaceSkillResetScope = z.infer<
  typeof workspaceSkillResetScopeSchema
>

export const workspaceSkillResetRequestSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
  scope: workspaceSkillResetScopeSchema.default("companion_files"),
})

export const workspaceSkillResetResponseSchema = z.object({
  applyQueued: z.boolean(),
  desiredStateVersion: z.number().int().positive(),
  resetScope: workspaceSkillResetScopeSchema,
  skillKey: z.string().min(1),
})

export type WorkspaceSkillResetResponse = z.infer<
  typeof workspaceSkillResetResponseSchema
>

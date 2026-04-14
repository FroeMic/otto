import * as z from "zod"

export const workspaceSkillSourceTypeSchema = z.enum([
  "integration_contribution",
  "system",
  "user",
])

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

export const workspaceSkillListEntrySchema = z.object({
  description: z.string(),
  displayName: z.string(),
  editable: z.boolean(),
  enabled: z.boolean(),
  skillKey: z.string().min(1),
  sourceType: workspaceSkillSourceTypeSchema,
  status: workspaceSkillStatusSchema,
  updatedAt: z.string(),
})

export type WorkspaceSkillListEntry = z.infer<
  typeof workspaceSkillListEntrySchema
>

export const workspaceSkillsListResponseSchema = z.object({
  knownIntegrationKeys: z.array(z.string()),
  skills: z.array(workspaceSkillListEntrySchema),
  state: z.enum(["pending_setup", "ready"]),
})

export type WorkspaceSkillsListResponse = z.infer<
  typeof workspaceSkillsListResponseSchema
>

export const workspaceSkillSectionSchema = z.enum(["files", "status"])

export type WorkspaceSkillSection = z.infer<
  typeof workspaceSkillSectionSchema
>

export const workspaceSkillDetailSchema = z.object({
  dependencies: workspaceSkillDependencySummarySchema,
  description: z.string(),
  displayName: z.string(),
  editable: z.boolean(),
  files: z.array(workspaceSkillFileSchema),
  skillKey: z.string().min(1),
  sourceType: workspaceSkillSourceTypeSchema,
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

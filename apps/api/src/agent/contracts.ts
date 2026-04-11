import { z } from "zod"

export const agentInstructionFilePathSchema = z.enum([
  "AGENTS.md",
  "IDENTITY.md",
  "SOUL.md",
  "TOOLS.md",
  "USER.md",
])

export const agentInstructionTabSchema = z.object({
  filePath: agentInstructionFilePathSchema,
  label: z.string().min(1),
  slug: z.string().min(1),
})

export const agentPersonalizationStateSchema = z.enum([
  "pending_setup",
  "ready",
])

export const agentPersonalizationOverviewResponseSchema = z.object({
  defaultInstructionTab: z.string().min(1),
  state: agentPersonalizationStateSchema,
  tabs: z.array(agentInstructionTabSchema),
})

export const agentInstructionSchema = z.object({
  description: z.string().min(1),
  filePath: agentInstructionFilePathSchema,
  label: z.string().min(1),
  sharedContent: z.string(),
  slug: z.string().min(1),
  systemContent: z.string(),
  version: z.number().int().positive(),
})

export const agentPersonalizationDetailResponseSchema = z.object({
  defaultInstructionTab: z.string().min(1),
  instruction: agentInstructionSchema.nullable(),
  selectedTab: agentInstructionTabSchema,
  state: agentPersonalizationStateSchema,
  tabs: z.array(agentInstructionTabSchema),
})

export const agentInstructionUpdateRequestSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
  sharedContent: z.string().trim().min(1),
})

export const agentInstructionUpdateResponseSchema = z.object({
  applyQueued: z.boolean(),
  changed: z.boolean(),
  currentVersion: z.number().int().positive(),
  desiredStateVersion: z.number().int().positive().optional(),
  instruction: agentInstructionSchema,
  managedConfigVersion: z.number().int().positive().optional(),
})

export type AgentInstructionTab = z.infer<typeof agentInstructionTabSchema>
export type AgentInstruction = z.infer<typeof agentInstructionSchema>
export type AgentPersonalizationOverviewResponse = z.infer<
  typeof agentPersonalizationOverviewResponseSchema
>
export type AgentPersonalizationDetailResponse = z.infer<
  typeof agentPersonalizationDetailResponseSchema
>
export type AgentInstructionUpdateRequest = z.infer<
  typeof agentInstructionUpdateRequestSchema
>
export type AgentInstructionUpdateResponse = z.infer<
  typeof agentInstructionUpdateResponseSchema
>

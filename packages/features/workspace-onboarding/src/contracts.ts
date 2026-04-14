import { z } from "zod"

export const workspaceOnboardingAnswerKeys = {
  requiredForProvisioning: [
    "workspace_name",
    "workspace_slug",
    "business_type",
    "team_size",
  ] as const,
}

export const workspaceOnboardingBusinessTypeSchema = z.enum([
  "saas",
  "ai_product",
  "agency_or_service",
  "marketplace",
  "internal_tool_or_ops",
  "other",
])

export const workspaceOnboardingTeamSizeSchema = z.enum([
  "solo",
  "2_5",
  "6_20",
  "21_plus",
])

export const workspaceOnboardingAnswerSchema = z.object({
  business_type: workspaceOnboardingBusinessTypeSchema.optional(),
  invite_emails: z.array(z.string().email()).optional(),
  team_size: workspaceOnboardingTeamSizeSchema.optional(),
  workspace_name: z.string().min(1).optional(),
  workspace_slug: z.string().min(1).optional(),
})

export const workspaceOnboardingRunStatusSchema = z.enum([
  "draft",
  "collecting_answers",
  "waiting_review",
  "accepted_pending_provision",
  "provisioning",
  "ready",
  "waitlisted",
  "failed",
])

export const workspaceOnboardingWaitlistDecisionSchema = z.enum([
  "pending",
  "accepted",
  "waitlisted",
  "manual_review",
])

export type WorkspaceOnboardingAnswers = z.infer<
  typeof workspaceOnboardingAnswerSchema
>

export type WorkspaceOnboardingRunStatus = z.infer<
  typeof workspaceOnboardingRunStatusSchema
>

export type WorkspaceOnboardingWaitlistDecision = z.infer<
  typeof workspaceOnboardingWaitlistDecisionSchema
>

import { z } from "zod"

export const workspaceOnboardingAnswerKeys = {
  requiredForProvisioning: [
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

export const workspaceOnboardingStepKeySchema = z.enum([
  "workspace_identity",
  "business_type",
  "team_setup",
])

export const workspaceOnboardingHoldingStateSchema = z.enum([
  "onboarding",
  "waiting",
  "waitlist",
  "ready",
])

export const workspaceOnboardingRunSummarySchema = z.object({
  answers: workspaceOnboardingAnswerSchema,
  currentStepKey: workspaceOnboardingStepKeySchema.nullable(),
  holdingState: workspaceOnboardingHoldingStateSchema,
  initialProvisioningJobId: z.string().uuid().nullable(),
  initialTenantId: z.string().uuid().nullable(),
  isOrganizationReady: z.boolean(),
  organizationId: z.string().uuid(),
  organizationSlug: z.string().min(1),
  provisioningStartedAt: z.string().datetime().nullable(),
  starterPrompt: z.string().nullable(),
  starterPromptConsumedAt: z.string().datetime().nullable(),
  status: workspaceOnboardingRunStatusSchema,
  waitlistDecision: workspaceOnboardingWaitlistDecisionSchema,
  waitlistReason: z.string().nullable(),
})

export const workspaceOnboardingSaveRequestSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("save-workspace-identity"),
      workspaceName: z.string().min(1),
      workspaceSlug: z.string().min(1),
    }),
    z.object({
      action: z.literal("save-business-type"),
      businessType: workspaceOnboardingBusinessTypeSchema,
    }),
    z.object({
      action: z.literal("save-team-setup"),
      teamSize: workspaceOnboardingTeamSizeSchema,
    }),
  ],
)

export type WorkspaceOnboardingAnswers = z.infer<
  typeof workspaceOnboardingAnswerSchema
>

export type WorkspaceOnboardingBusinessType = z.infer<
  typeof workspaceOnboardingBusinessTypeSchema
>

export type WorkspaceOnboardingHoldingState = z.infer<
  typeof workspaceOnboardingHoldingStateSchema
>

export type WorkspaceOnboardingRunStatus = z.infer<
  typeof workspaceOnboardingRunStatusSchema
>

export type WorkspaceOnboardingWaitlistDecision = z.infer<
  typeof workspaceOnboardingWaitlistDecisionSchema
>

export type WorkspaceOnboardingRunSummary = z.infer<
  typeof workspaceOnboardingRunSummarySchema
>

export type WorkspaceOnboardingSaveRequest = z.infer<
  typeof workspaceOnboardingSaveRequestSchema
>

export type WorkspaceOnboardingTeamSize = z.infer<
  typeof workspaceOnboardingTeamSizeSchema
>

export type WorkspaceOnboardingStepKey = z.infer<
  typeof workspaceOnboardingStepKeySchema
>

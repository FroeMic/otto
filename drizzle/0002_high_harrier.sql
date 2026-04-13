ALTER TABLE "tenant_onboarding_sessions" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_onboarding_sessions" ADD COLUMN "slack_bot_token_ciphertext" text;--> statement-breakpoint
ALTER TABLE "tenant_onboarding_sessions" ADD COLUMN "slack_bot_user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenant_onboarding_sessions" ADD COLUMN "slack_installed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_onboarding_sessions" ADD COLUMN "slack_scope_csv" text;--> statement-breakpoint
ALTER TABLE "tenant_onboarding_sessions" ADD COLUMN "slack_team_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenant_onboarding_sessions" ADD COLUMN "slack_team_name" text;--> statement-breakpoint
ALTER TABLE "tenant_onboarding_sessions" ADD CONSTRAINT "tenant_onboarding_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_onboarding_sessions_tenant_id_idx" ON "tenant_onboarding_sessions" USING btree ("tenant_id");
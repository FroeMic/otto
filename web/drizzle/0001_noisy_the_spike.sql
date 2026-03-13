CREATE TABLE "tenant_onboarding_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_name" text NOT NULL,
	"status" varchar(64) NOT NULL,
	"slack_connected_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_onboarding_sessions" ADD CONSTRAINT "tenant_onboarding_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_onboarding_sessions" ADD CONSTRAINT "tenant_onboarding_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_onboarding_sessions_organization_id_idx" ON "tenant_onboarding_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tenant_onboarding_sessions_user_id_idx" ON "tenant_onboarding_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_onboarding_sessions_status_idx" ON "tenant_onboarding_sessions" USING btree ("status");
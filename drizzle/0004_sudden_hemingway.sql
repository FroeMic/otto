CREATE TABLE "integration_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_integration_id" uuid NOT NULL,
	"secret_type" varchar(64) NOT NULL,
	"ciphertext" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "slack_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_integration_id" uuid NOT NULL,
	"slack_team_id" varchar(255) NOT NULL,
	"slack_team_name" text,
	"slack_bot_user_id" varchar(255),
	"installer_user_id" varchar(255),
	"scope_csv" text,
	"installed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_key" varchar(64) NOT NULL,
	"status" varchar(64) NOT NULL,
	"connected_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_onboarding_sessions" ADD COLUMN "slack_oauth_error" text;--> statement-breakpoint
ALTER TABLE "tenant_onboarding_sessions" ADD COLUMN "slack_oauth_error_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_secrets" ADD CONSTRAINT "integration_secrets_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_installations" ADD CONSTRAINT "slack_installations_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_integrations" ADD CONSTRAINT "tenant_integrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_secrets_tenant_integration_id_idx" ON "integration_secrets" USING btree ("tenant_integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_secrets_tenant_integration_id_secret_type_idx" ON "integration_secrets" USING btree ("tenant_integration_id","secret_type");--> statement-breakpoint
CREATE UNIQUE INDEX "slack_installations_tenant_integration_id_idx" ON "slack_installations" USING btree ("tenant_integration_id");--> statement-breakpoint
CREATE INDEX "tenant_integrations_provider_status_idx" ON "tenant_integrations" USING btree ("provider_key","status");--> statement-breakpoint
CREATE INDEX "tenant_integrations_tenant_id_idx" ON "tenant_integrations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_integrations_tenant_id_provider_key_idx" ON "tenant_integrations" USING btree ("tenant_id","provider_key");
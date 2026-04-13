CREATE TABLE "integration_oauth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_integration_id" uuid,
	"provider_key" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" varchar(32) NOT NULL,
	"state_nonce" varchar(255) NOT NULL,
	"pkce_code_verifier" text,
	"requested_scopes_csv" text,
	"authorize_params_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_linear_installations" ALTER COLUMN "nango_connection_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_linear_installations" ALTER COLUMN "nango_integration_id" DROP NOT NULL;--> statement-breakpoint
CREATE TABLE "integration_oauth_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_integration_id" uuid NOT NULL,
	"provider_key" varchar(64) NOT NULL,
	"external_account_id" varchar(255),
	"external_account_label" text,
	"auth_mode" varchar(64) NOT NULL,
	"actor_type" varchar(32),
	"status" varchar(64) NOT NULL,
	"requested_scopes_csv" text,
	"granted_scopes_csv" text,
	"credentials_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"last_refresh_started_at" timestamp with time zone,
	"last_refresh_succeeded_at" timestamp with time zone,
	"last_refresh_failed_at" timestamp with time zone,
	"refresh_attempt_count" integer DEFAULT 0 NOT NULL,
	"refresh_retry_after" timestamp with time zone,
	"token_version" integer DEFAULT 1 NOT NULL,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_oauth_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"access_token_ciphertext" text NOT NULL,
	"refresh_token_ciphertext" text,
	"id_token_ciphertext" text,
	"token_type" varchar(64),
	"raw_token_response_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rotated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_oauth_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid,
	"tenant_integration_id" uuid,
	"provider_key" varchar(64) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"status_before" varchar(64),
	"status_after" varchar(64),
	"details_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_oauth_sessions" ADD CONSTRAINT "integration_oauth_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_sessions" ADD CONSTRAINT "integration_oauth_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_sessions" ADD CONSTRAINT "integration_oauth_sessions_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_sessions" ADD CONSTRAINT "integration_oauth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_connections" ADD CONSTRAINT "integration_oauth_connections_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_credentials" ADD CONSTRAINT "integration_oauth_credentials_connection_id_integration_oauth_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_oauth_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_events" ADD CONSTRAINT "integration_oauth_events_connection_id_integration_oauth_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_oauth_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_events" ADD CONSTRAINT "integration_oauth_events_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_oauth_sessions_provider_id_idx" ON "integration_oauth_sessions" USING btree ("provider_key","id");--> statement-breakpoint
CREATE INDEX "integration_oauth_sessions_tenant_id_idx" ON "integration_oauth_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "integration_oauth_sessions_user_id_idx" ON "integration_oauth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_oauth_connections_tenant_integration_id_idx" ON "integration_oauth_connections" USING btree ("tenant_integration_id");--> statement-breakpoint
CREATE INDEX "integration_oauth_connections_provider_status_idx" ON "integration_oauth_connections" USING btree ("provider_key","status");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_oauth_credentials_connection_id_idx" ON "integration_oauth_credentials" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "integration_oauth_events_connection_id_idx" ON "integration_oauth_events" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "integration_oauth_events_tenant_integration_id_idx" ON "integration_oauth_events" USING btree ("tenant_integration_id");

CREATE TABLE "integration_api_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_integration_id" uuid NOT NULL,
  "provider_key" varchar(64) NOT NULL,
  "credential_type" varchar(64) NOT NULL,
  "secret_ciphertext" text NOT NULL,
  "status" varchar(64) DEFAULT 'connected' NOT NULL,
  "declared_scopes_csv" text,
  "external_account_label" text,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_validated_at" timestamp with time zone,
  "last_error" text,
  "last_error_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_integration_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_integration_id" uuid NOT NULL,
  "provider_key" varchar(64) NOT NULL,
  "state_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "state_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_api_credentials" ADD CONSTRAINT "integration_api_credentials_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_integration_state" ADD CONSTRAINT "tenant_integration_state_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "integration_api_credentials_provider_status_idx" ON "integration_api_credentials" USING btree ("provider_key","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "integration_api_credentials_tenant_integration_id_idx" ON "integration_api_credentials" USING btree ("tenant_integration_id");
--> statement-breakpoint
CREATE INDEX "tenant_integration_state_provider_idx" ON "tenant_integration_state" USING btree ("provider_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_integration_state_tenant_integration_id_idx" ON "tenant_integration_state" USING btree ("tenant_integration_id");

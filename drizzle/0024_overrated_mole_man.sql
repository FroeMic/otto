CREATE TABLE "provider_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_key" varchar(64) NOT NULL,
	"display_name" text,
	"external_project_id" varchar(255),
	"external_service_account_id" varchar(255),
	"external_api_key_id" varchar(255),
	"status" varchar(64) NOT NULL,
	"provisioned_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_account_id" uuid NOT NULL,
	"credential_type" varchar(64) NOT NULL,
	"ciphertext" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_provider_account_id_provider_accounts_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provider_accounts_tenant_id_idx" ON "provider_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_accounts_tenant_id_provider_key_idx" ON "provider_accounts" USING btree ("tenant_id","provider_key");--> statement-breakpoint
CREATE INDEX "provider_accounts_tenant_id_provider_key_status_idx" ON "provider_accounts" USING btree ("tenant_id","provider_key","status");--> statement-breakpoint
CREATE INDEX "provider_credentials_provider_account_id_idx" ON "provider_credentials" USING btree ("provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_credentials_provider_account_id_credential_type_idx" ON "provider_credentials" USING btree ("provider_account_id","credential_type");
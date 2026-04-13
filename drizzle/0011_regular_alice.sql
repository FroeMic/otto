CREATE TABLE "tenant_runtime_config_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"surface_kind" varchar(64) NOT NULL,
	"surface_key" varchar(255) NOT NULL,
	"schema_source" varchar(64) NOT NULL,
	"schema_version" varchar(64) NOT NULL,
	"entry_version" integer DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config_json" jsonb NOT NULL,
	"last_validated_at" timestamp with time zone,
	"last_validation_error" text,
	"created_by_type" varchar(64) NOT NULL,
	"created_by_external_id" varchar(255),
	"updated_by_type" varchar(64) NOT NULL,
	"updated_by_external_id" varchar(255),
	"change_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_runtime_config_entries" ADD CONSTRAINT "tenant_runtime_config_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_runtime_config_entries_tenant_id_idx" ON "tenant_runtime_config_entries" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_runtime_config_entries_tenant_id_surface_kind_surface_key_idx" ON "tenant_runtime_config_entries" USING btree ("tenant_id","surface_kind","surface_key");
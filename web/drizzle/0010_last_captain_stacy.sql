CREATE TABLE "tenant_managed_config_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"created_by_type" varchar(64) NOT NULL,
	"created_by_external_id" varchar(255),
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_managed_file_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_managed_config_version_id" uuid NOT NULL,
	"path" varchar(255) NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"system_content" text NOT NULL,
	"shared_content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_managed_config_versions" ADD CONSTRAINT "tenant_managed_config_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_managed_file_versions" ADD CONSTRAINT "tenant_managed_file_versions_tenant_managed_config_version_id_tenant_managed_config_versions_id_fk" FOREIGN KEY ("tenant_managed_config_version_id") REFERENCES "public"."tenant_managed_config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_managed_config_versions_tenant_id_idx" ON "tenant_managed_config_versions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_managed_config_versions_tenant_id_version_idx" ON "tenant_managed_config_versions" USING btree ("tenant_id","version");--> statement-breakpoint
CREATE INDEX "tenant_managed_file_versions_config_version_id_idx" ON "tenant_managed_file_versions" USING btree ("tenant_managed_config_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_managed_file_versions_config_version_id_path_idx" ON "tenant_managed_file_versions" USING btree ("tenant_managed_config_version_id","path");
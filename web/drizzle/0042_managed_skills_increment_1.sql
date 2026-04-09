CREATE TABLE "tenant_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"skill_key" varchar(128) NOT NULL,
	"display_name" text NOT NULL,
	"description" text NOT NULL,
	"status" varchar(64) NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"depends_on_json" jsonb,
	"created_by_type" varchar(64) NOT NULL,
	"created_by_external_id" varchar(255),
	"updated_by_type" varchar(64) NOT NULL,
	"updated_by_external_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_skill_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_skill_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"summary" text,
	"created_by_type" varchar(64) NOT NULL,
	"created_by_external_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_skill_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_skill_id" uuid NOT NULL,
	"relative_path" varchar(512) NOT NULL,
	"file_kind" varchar(32) NOT NULL,
	"content_type" varchar(255),
	"content_encoding" varchar(32) NOT NULL,
	"content_sha256" varchar(64),
	"last_seen_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_skill_file_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_skill_file_id" uuid NOT NULL,
	"tenant_skill_version_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content_text" text NOT NULL,
	"content_sha256" varchar(64) NOT NULL,
	"created_by_type" varchar(64) NOT NULL,
	"created_by_external_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_skills" ADD CONSTRAINT "tenant_skills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_skill_versions" ADD CONSTRAINT "tenant_skill_versions_tenant_skill_id_tenant_skills_id_fk" FOREIGN KEY ("tenant_skill_id") REFERENCES "public"."tenant_skills"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_skill_files" ADD CONSTRAINT "tenant_skill_files_tenant_skill_id_tenant_skills_id_fk" FOREIGN KEY ("tenant_skill_id") REFERENCES "public"."tenant_skills"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_skill_file_versions" ADD CONSTRAINT "tenant_skill_file_versions_tenant_skill_file_id_tenant_skill_files_id_fk" FOREIGN KEY ("tenant_skill_file_id") REFERENCES "public"."tenant_skill_files"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_skill_file_versions" ADD CONSTRAINT "tenant_skill_file_versions_tenant_skill_version_id_tenant_skill_versions_id_fk" FOREIGN KEY ("tenant_skill_version_id") REFERENCES "public"."tenant_skill_versions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tenant_skills_tenant_id_idx" ON "tenant_skills" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_skills_tenant_id_skill_key_idx" ON "tenant_skills" USING btree ("tenant_id","skill_key");
--> statement-breakpoint
CREATE INDEX "tenant_skill_versions_skill_id_idx" ON "tenant_skill_versions" USING btree ("tenant_skill_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_skill_versions_skill_id_version_idx" ON "tenant_skill_versions" USING btree ("tenant_skill_id","version");
--> statement-breakpoint
CREATE INDEX "tenant_skill_files_skill_id_idx" ON "tenant_skill_files" USING btree ("tenant_skill_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_skill_files_skill_id_relative_path_idx" ON "tenant_skill_files" USING btree ("tenant_skill_id","relative_path");
--> statement-breakpoint
CREATE INDEX "tenant_skill_file_versions_file_id_idx" ON "tenant_skill_file_versions" USING btree ("tenant_skill_file_id");
--> statement-breakpoint
CREATE INDEX "tenant_skill_file_versions_skill_version_id_idx" ON "tenant_skill_file_versions" USING btree ("tenant_skill_version_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_skill_file_versions_file_id_version_idx" ON "tenant_skill_file_versions" USING btree ("tenant_skill_file_id","version");

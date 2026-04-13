CREATE TABLE "tenant_runtime_config_mutations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_runtime_config_entry_id" uuid,
	"actor_type" varchar(64) NOT NULL,
	"actor_external_id" varchar(255),
	"mutation_type" varchar(64) NOT NULL,
	"expected_entry_version" integer,
	"resulting_entry_version" integer,
	"patch_json" jsonb,
	"result_json" jsonb,
	"desired_state_version" integer,
	"apply_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_runtime_config_entries" ADD COLUMN "install_state" varchar(64) DEFAULT 'installed' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_runtime_config_mutations" ADD CONSTRAINT "tenant_runtime_config_mutations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_runtime_config_mutations" ADD CONSTRAINT "tenant_runtime_config_mutations_tenant_runtime_config_entry_id_tenant_runtime_config_entries_id_fk" FOREIGN KEY ("tenant_runtime_config_entry_id") REFERENCES "public"."tenant_runtime_config_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_runtime_config_mutations" ADD CONSTRAINT "tenant_runtime_config_mutations_apply_run_id_tenant_apply_runs_id_fk" FOREIGN KEY ("apply_run_id") REFERENCES "public"."tenant_apply_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_runtime_config_mutations_tenant_id_idx" ON "tenant_runtime_config_mutations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_runtime_config_mutations_entry_id_idx" ON "tenant_runtime_config_mutations" USING btree ("tenant_runtime_config_entry_id");
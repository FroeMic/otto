CREATE TABLE "tenant_apply_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_run_id" uuid NOT NULL,
	"desired_state_version" integer NOT NULL,
	"status" varchar(64) NOT NULL,
	"error" text,
	"restart_stdout" text,
	"restart_stderr" text,
	"verify_stdout" text,
	"verify_stderr" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_runtime_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"secret_type" varchar(64) NOT NULL,
	"ciphertext" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tenant_apply_runs" ADD CONSTRAINT "tenant_apply_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_apply_runs" ADD CONSTRAINT "tenant_apply_runs_job_run_id_job_runs_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_runtime_secrets" ADD CONSTRAINT "tenant_runtime_secrets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_apply_runs_job_run_id_idx" ON "tenant_apply_runs" USING btree ("job_run_id");--> statement-breakpoint
CREATE INDEX "tenant_apply_runs_tenant_id_idx" ON "tenant_apply_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_apply_runs_tenant_id_status_idx" ON "tenant_apply_runs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tenant_runtime_secrets_tenant_id_idx" ON "tenant_runtime_secrets" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_runtime_secrets_tenant_id_secret_type_idx" ON "tenant_runtime_secrets" USING btree ("tenant_id","secret_type");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_desired_states_tenant_id_version_idx" ON "tenant_desired_states" USING btree ("tenant_id","version");
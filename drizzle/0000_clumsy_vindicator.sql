CREATE TABLE "job_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_run_id" uuid NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"data_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" varchar(64) NOT NULL,
	"tenant_id" uuid,
	"status" varchar(64) NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"payload_json" jsonb NOT NULL,
	"result_json" jsonb,
	"error" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_desired_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"config_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"provider_server_id" varchar(255),
	"ipv4" varchar(64),
	"ssh_username" varchar(255),
	"status" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_run_id_job_runs_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_desired_states" ADD CONSTRAINT "tenant_desired_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_servers" ADD CONSTRAINT "tenant_servers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_events_job_run_id_idx" ON "job_events" USING btree ("job_run_id");--> statement-breakpoint
CREATE INDEX "job_runs_status_available_at_idx" ON "job_runs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "job_runs_tenant_id_idx" ON "job_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "memberships_organization_id_idx" ON "memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_desired_states_tenant_id_idx" ON "tenant_desired_states" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_servers_tenant_id_idx" ON "tenant_servers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenants_organization_id_idx" ON "tenants" USING btree ("organization_id");
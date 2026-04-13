CREATE TABLE "tenant_scheduled_task_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_scheduled_task_id" uuid,
	"task_key" text NOT NULL,
	"task_name" text NOT NULL,
	"external_run_key" text NOT NULL,
	"external_session_id" text,
	"runtime_session_key" text,
	"trigger_type" varchar(64) NOT NULL,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"status" varchar(64) NOT NULL,
	"summary" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_scheduled_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"task_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"schedule_kind" varchar(32) NOT NULL,
	"schedule_expression" text NOT NULL,
	"timezone" varchar(128),
	"session_target" varchar(64),
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_run_status" varchar(32),
	"last_error" text,
	"runtime_updated_at" bigint,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_scheduled_task_sessions" ADD CONSTRAINT "tenant_scheduled_task_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_scheduled_task_sessions" ADD CONSTRAINT "tenant_scheduled_task_sessions_tenant_scheduled_task_id_tenant_scheduled_tasks_id_fk" FOREIGN KEY ("tenant_scheduled_task_id") REFERENCES "public"."tenant_scheduled_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_scheduled_tasks" ADD CONSTRAINT "tenant_scheduled_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_scheduled_task_sessions_tenant_id_idx" ON "tenant_scheduled_task_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_scheduled_task_sessions_tenant_scheduled_task_id_idx" ON "tenant_scheduled_task_sessions" USING btree ("tenant_scheduled_task_id");--> statement-breakpoint
CREATE INDEX "tenant_scheduled_task_sessions_tenant_id_started_at_idx" ON "tenant_scheduled_task_sessions" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_scheduled_task_sessions_tenant_id_external_run_key_idx" ON "tenant_scheduled_task_sessions" USING btree ("tenant_id","external_run_key");--> statement-breakpoint
CREATE INDEX "tenant_scheduled_tasks_tenant_id_idx" ON "tenant_scheduled_tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_scheduled_tasks_tenant_id_status_idx" ON "tenant_scheduled_tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tenant_scheduled_tasks_tenant_id_next_run_at_idx" ON "tenant_scheduled_tasks" USING btree ("tenant_id","next_run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_scheduled_tasks_tenant_id_task_key_idx" ON "tenant_scheduled_tasks" USING btree ("tenant_id","task_key");
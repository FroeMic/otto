ALTER TABLE "tenant_scheduled_tasks" ADD COLUMN "schedule_json" jsonb;--> statement-breakpoint
ALTER TABLE "tenant_scheduled_tasks" ADD COLUMN "payload_json" jsonb;--> statement-breakpoint
ALTER TABLE "tenant_scheduled_tasks" ADD COLUMN "delivery_json" jsonb;--> statement-breakpoint
ALTER TABLE "tenant_scheduled_tasks" ADD COLUMN "failure_alert_json" jsonb;--> statement-breakpoint
ALTER TABLE "tenant_scheduled_tasks" ADD COLUMN "wake_mode" varchar(32);--> statement-breakpoint
ALTER TABLE "tenant_scheduled_tasks" ADD COLUMN "delete_after_run" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_scheduled_tasks" ADD COLUMN "agent_id" text;--> statement-breakpoint
ALTER TABLE "tenant_scheduled_tasks" ADD COLUMN "session_key" text;
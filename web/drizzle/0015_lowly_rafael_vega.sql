CREATE TABLE "tenant_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_key" text NOT NULL,
	"external_session_id" text,
	"display_name" text,
	"label" text,
	"subject" text,
	"channel" varchar(64),
	"channel_provider" varchar(64),
	"chat_type" varchar(64),
	"origin_from" text,
	"origin_to" text,
	"origin_account_id" text,
	"origin_thread_id" text,
	"status" varchar(64) DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"runtime_ms" integer,
	"model" text,
	"model_provider" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"total_tokens" integer,
	"estimated_cost_usd" numeric(10, 6),
	"transcript_jsonl" text,
	"transcript_hash" varchar(64),
	"message_count" integer,
	"parent_session_key" text,
	"spawn_depth" integer DEFAULT 0,
	"subagent_role" varchar(32),
	"session_updated_at" bigint,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_error" text,
	"sync_source" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_sessions" ADD CONSTRAINT "tenant_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_sessions_tenant_id_idx" ON "tenant_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_sessions_tenant_id_session_key_idx" ON "tenant_sessions" USING btree ("tenant_id","session_key");--> statement-breakpoint
CREATE INDEX "tenant_sessions_tenant_id_status_idx" ON "tenant_sessions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tenant_sessions_tenant_id_channel_idx" ON "tenant_sessions" USING btree ("tenant_id","channel");--> statement-breakpoint
CREATE INDEX "tenant_sessions_tenant_id_session_updated_at_idx" ON "tenant_sessions" USING btree ("tenant_id","session_updated_at");

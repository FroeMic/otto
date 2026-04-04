ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "locale" varchar(32) DEFAULT 'en-US' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "time_format_preference" varchar(16) DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "timezone" varchar(128) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_sessions" ADD COLUMN IF NOT EXISTS "last_message_at" bigint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_sessions_tenant_id_last_message_at_idx" ON "tenant_sessions" USING btree ("tenant_id","last_message_at");

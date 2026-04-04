ALTER TABLE "organizations" ADD COLUMN "locale" varchar(32) DEFAULT 'en-US' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "time_format_preference" varchar(16) DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "timezone" varchar(128) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_sessions" ADD COLUMN "last_message_at" bigint;--> statement-breakpoint
CREATE INDEX "tenant_sessions_tenant_id_last_message_at_idx" ON "tenant_sessions" USING btree ("tenant_id","last_message_at");
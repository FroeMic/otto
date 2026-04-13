ALTER TABLE "tenant_sessions" ADD COLUMN IF NOT EXISTS "last_message_at" bigint;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_sessions_tenant_id_last_message_at_idx" ON "tenant_sessions" USING btree ("tenant_id","last_message_at");

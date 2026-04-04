DROP INDEX "tenant_sessions_tenant_id_session_key_idx";--> statement-breakpoint
UPDATE "tenant_sessions" SET "external_session_id" = "id"::text WHERE "external_session_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tenant_sessions" ALTER COLUMN "external_session_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_sessions_tenant_id_session_key_external_session_id_idx" ON "tenant_sessions" USING btree ("tenant_id","session_key","external_session_id");

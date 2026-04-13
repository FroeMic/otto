ALTER TABLE "tenant_runtime_secrets" ADD COLUMN "lookup_hash" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_runtime_secrets_secret_type_lookup_hash_idx" ON "tenant_runtime_secrets" USING btree ("secret_type","lookup_hash") WHERE "tenant_runtime_secrets"."lookup_hash" is not null;

DROP INDEX "provider_credentials_provider_account_id_credential_type_idx";--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD COLUMN "external_api_key_id" varchar(255);--> statement-breakpoint
CREATE INDEX "provider_credentials_provider_account_id_credential_type_revoked_at_idx" ON "provider_credentials" USING btree ("provider_account_id","credential_type","revoked_at");--> statement-breakpoint
CREATE INDEX "provider_credentials_provider_account_id_credential_type_idx" ON "provider_credentials" USING btree ("provider_account_id","credential_type");
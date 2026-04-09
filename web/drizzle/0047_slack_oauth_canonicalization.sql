ALTER TABLE "integration_oauth_connections"
ADD COLUMN "provider_metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
DROP TABLE IF EXISTS "integration_slack_installations";
--> statement-breakpoint
DROP TABLE IF EXISTS "integration_credentials";

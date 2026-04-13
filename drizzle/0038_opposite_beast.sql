ALTER TABLE "integration_linear_installations" DROP CONSTRAINT "integration_linear_installations_nango_connection_id_unique";--> statement-breakpoint
ALTER TABLE "integration_linear_installations" DROP COLUMN "nango_connection_id";--> statement-breakpoint
ALTER TABLE "integration_linear_installations" DROP COLUMN "nango_integration_id";

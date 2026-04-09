CREATE TABLE "integration_ingress_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_integration_id" uuid NOT NULL,
  "provider_key" varchar(64) NOT NULL,
  "endpoint_key" varchar(64) NOT NULL,
  "request_path" varchar(255) NOT NULL,
  "external_workspace_id" varchar(255),
  "external_account_id" varchar(255),
  "status" varchar(64) NOT NULL,
  "attempt" integer DEFAULT 1 NOT NULL,
  "response_status" integer,
  "error" text,
  "provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "integration_ingress_deliveries" ADD CONSTRAINT "integration_ingress_deliveries_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "integration_ingress_deliveries" (
  "id",
  "tenant_integration_id",
  "provider_key",
  "endpoint_key",
  "request_path",
  "external_workspace_id",
  "external_account_id",
  "status",
  "attempt",
  "response_status",
  "error",
  "provider_metadata",
  "created_at",
  "finished_at"
)
SELECT
  "id",
  "tenant_integration_id",
  'slack',
  "request_type",
  "request_path",
  "team_id",
  "enterprise_id",
  "status",
  "attempt",
  "response_status",
  "error",
  '{}'::jsonb,
  "created_at",
  "finished_at"
FROM "slack_ingress_deliveries";
--> statement-breakpoint
CREATE INDEX "integration_ingress_deliveries_tenant_integration_id_idx" ON "integration_ingress_deliveries" USING btree ("tenant_integration_id");
--> statement-breakpoint
CREATE INDEX "integration_ingress_deliveries_external_workspace_id_status_idx" ON "integration_ingress_deliveries" USING btree ("external_workspace_id","status");
--> statement-breakpoint
CREATE INDEX "integration_ingress_deliveries_provider_endpoint_created_at_idx" ON "integration_ingress_deliveries" USING btree ("provider_key","endpoint_key","created_at");
--> statement-breakpoint
DROP TABLE "slack_ingress_deliveries";

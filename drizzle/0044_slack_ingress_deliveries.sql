CREATE TABLE "slack_ingress_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_integration_id" uuid NOT NULL,
  "request_type" varchar(64) NOT NULL,
  "request_path" varchar(255) NOT NULL,
  "team_id" varchar(255) NOT NULL,
  "enterprise_id" varchar(255),
  "status" varchar(64) NOT NULL,
  "attempt" integer DEFAULT 1 NOT NULL,
  "response_status" integer,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "slack_ingress_deliveries" ADD CONSTRAINT "slack_ingress_deliveries_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "slack_ingress_deliveries_tenant_integration_id_idx" ON "slack_ingress_deliveries" USING btree ("tenant_integration_id");
--> statement-breakpoint
CREATE INDEX "slack_ingress_deliveries_team_id_status_idx" ON "slack_ingress_deliveries" USING btree ("team_id","status");

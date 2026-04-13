CREATE TABLE "integration_execution_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_integration_id" uuid,
	"integration_key" varchar(64) NOT NULL,
	"operation_key" varchar(64) NOT NULL,
	"status" varchar(32) NOT NULL,
	"request_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_json" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_execution_audits" ADD CONSTRAINT "integration_execution_audits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_execution_audits" ADD CONSTRAINT "integration_execution_audits_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_execution_audits_tenant_id_created_at_idx" ON "integration_execution_audits" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "integration_execution_audits_tenant_integration_id_created_at_idx" ON "integration_execution_audits" USING btree ("tenant_integration_id","created_at");--> statement-breakpoint
CREATE INDEX "integration_execution_audits_integration_key_operation_key_created_at_idx" ON "integration_execution_audits" USING btree ("integration_key","operation_key","created_at");
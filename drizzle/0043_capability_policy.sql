CREATE TABLE "tenant_integration_capability_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_integration_id" uuid NOT NULL,
  "capability_key" varchar(128) NOT NULL,
  "policy_json" jsonb DEFAULT '{"policy":"allow"}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_integration_capability_states" ADD CONSTRAINT "tenant_integration_capability_states_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tenant_integration_capability_states_tenant_integration_id_idx" ON "tenant_integration_capability_states" USING btree ("tenant_integration_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_integration_capability_states_tenant_integration_id_capability_key_idx" ON "tenant_integration_capability_states" USING btree ("tenant_integration_id","capability_key");

CREATE TABLE "tenant_runtime_bridge_statuses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "bridge_id" text NOT NULL,
  "bridge_status" varchar(32) NOT NULL,
  "gateway_healthy" boolean DEFAULT false NOT NULL,
  "gateway_port" integer,
  "gateway_status_code" integer,
  "installed_plugin_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "enabled_plugin_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "workspace_chat_enabled" boolean DEFAULT false NOT NULL,
  "session_reporter_enabled" boolean DEFAULT false NOT NULL,
  "control_plane_base_url" text,
  "last_reported_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_runtime_bridge_statuses" ADD CONSTRAINT "tenant_runtime_bridge_statuses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_runtime_bridge_statuses_tenant_id_idx" ON "tenant_runtime_bridge_statuses" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "tenant_runtime_bridge_statuses_bridge_status_idx" ON "tenant_runtime_bridge_statuses" USING btree ("bridge_status","last_reported_at");

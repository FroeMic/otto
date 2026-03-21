CREATE TABLE "whatsapp_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_integration_id" uuid NOT NULL,
	"self_jid" varchar(255),
	"self_e164" varchar(32),
	"linked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_link_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_integration_id" uuid NOT NULL,
	"status" varchar(64) NOT NULL,
	"qr_data_url" text,
	"started_by_external_id" varchar(255),
	"force_relink" boolean DEFAULT false NOT NULL,
	"last_error" text,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_installations" ADD CONSTRAINT "whatsapp_installations_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_link_sessions" ADD CONSTRAINT "whatsapp_link_sessions_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_installations_tenant_integration_id_idx" ON "whatsapp_installations" USING btree ("tenant_integration_id");--> statement-breakpoint
CREATE INDEX "whatsapp_link_sessions_tenant_integration_id_idx" ON "whatsapp_link_sessions" USING btree ("tenant_integration_id");--> statement-breakpoint
CREATE INDEX "whatsapp_link_sessions_tenant_integration_id_status_idx" ON "whatsapp_link_sessions" USING btree ("tenant_integration_id","status");
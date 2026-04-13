CREATE TABLE "integration_linear_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_integration_id" uuid NOT NULL,
	"nango_connection_id" varchar(255) NOT NULL,
	"nango_integration_id" varchar(255) NOT NULL,
	"linear_workspace_id" varchar(255),
	"linear_workspace_name" text,
	"connected_by_user_id" uuid,
	"connected_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_linear_installations_nango_connection_id_unique" UNIQUE("nango_connection_id")
);
--> statement-breakpoint
ALTER TABLE "integration_linear_installations" ADD CONSTRAINT "integration_linear_installations_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_linear_installations" ADD CONSTRAINT "integration_linear_installations_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_linear_installations_tenant_integration_id_idx" ON "integration_linear_installations" USING btree ("tenant_integration_id");
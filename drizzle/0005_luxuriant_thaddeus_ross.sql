CREATE TABLE "messaging_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"messaging_workspace_id" uuid NOT NULL,
	"external_conversation_id" varchar(255) NOT NULL,
	"name" text,
	"conversation_type" varchar(64) NOT NULL,
	"topic" text,
	"purpose" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"metadata_json" jsonb,
	"last_synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messaging_workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"messaging_workspace_id" uuid NOT NULL,
	"external_member_id" varchar(255) NOT NULL,
	"username" varchar(255),
	"display_name" text,
	"full_name" text,
	"email" varchar(320),
	"avatar_url" text,
	"member_type" varchar(64) NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"profile_json" jsonb,
	"last_synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messaging_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_integration_id" uuid NOT NULL,
	"external_workspace_id" varchar(255) NOT NULL,
	"display_name" text,
	"sync_status" varchar(64) NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_error" text,
	"last_sync_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messaging_conversations" ADD CONSTRAINT "messaging_conversations_messaging_workspace_id_messaging_workspaces_id_fk" FOREIGN KEY ("messaging_workspace_id") REFERENCES "public"."messaging_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_workspace_members" ADD CONSTRAINT "messaging_workspace_members_messaging_workspace_id_messaging_workspaces_id_fk" FOREIGN KEY ("messaging_workspace_id") REFERENCES "public"."messaging_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_workspaces" ADD CONSTRAINT "messaging_workspaces_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messaging_conversations_workspace_id_idx" ON "messaging_conversations" USING btree ("messaging_workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_conversations_workspace_id_external_conversation_id_idx" ON "messaging_conversations" USING btree ("messaging_workspace_id","external_conversation_id");--> statement-breakpoint
CREATE INDEX "messaging_workspace_members_workspace_id_idx" ON "messaging_workspace_members" USING btree ("messaging_workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_workspace_members_workspace_id_external_member_id_idx" ON "messaging_workspace_members" USING btree ("messaging_workspace_id","external_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_workspaces_tenant_integration_id_idx" ON "messaging_workspaces" USING btree ("tenant_integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_workspaces_tenant_integration_id_external_workspace_id_idx" ON "messaging_workspaces" USING btree ("tenant_integration_id","external_workspace_id");
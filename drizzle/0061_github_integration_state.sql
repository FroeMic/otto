CREATE TABLE "integration_github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_integration_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"installation_id" varchar(64) NOT NULL,
	"account_id" varchar(64) NOT NULL,
	"account_login" varchar(255) NOT NULL,
	"account_type" varchar(64) NOT NULL,
	"app_id" varchar(64) NOT NULL,
	"app_slug" varchar(255),
	"repository_selection" varchar(32) NOT NULL,
	"permissions_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"events_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suspended_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_webhook_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_github_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_installation_id" uuid NOT NULL,
	"github_repository_id" varchar(64) NOT NULL,
	"owner_login" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"full_name" varchar(512) NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"default_branch" varchar(255),
	"archived" boolean DEFAULT false NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"selected_by_installation" boolean DEFAULT true NOT NULL,
	"enabled_for_workspace" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_github_installations" ADD CONSTRAINT "integration_github_installations_tenant_integration_id_tenant_integrations_id_fk" FOREIGN KEY ("tenant_integration_id") REFERENCES "public"."tenant_integrations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "integration_github_installations" ADD CONSTRAINT "integration_github_installations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "integration_github_repositories" ADD CONSTRAINT "integration_github_repositories_github_installation_id_integration_github_installations_id_fk" FOREIGN KEY ("github_installation_id") REFERENCES "public"."integration_github_installations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "integration_github_installations_tenant_id_installation_id_idx" ON "integration_github_installations" USING btree ("tenant_id","installation_id");
--> statement-breakpoint
CREATE INDEX "integration_github_installations_tenant_id_idx" ON "integration_github_installations" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "integration_github_installations_tenant_integration_id_idx" ON "integration_github_installations" USING btree ("tenant_integration_id");
--> statement-breakpoint
CREATE INDEX "integration_github_repositories_full_name_idx" ON "integration_github_repositories" USING btree ("full_name");
--> statement-breakpoint
CREATE INDEX "integration_github_repositories_installation_id_idx" ON "integration_github_repositories" USING btree ("github_installation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "integration_github_repositories_installation_repository_id_idx" ON "integration_github_repositories" USING btree ("github_installation_id","github_repository_id");

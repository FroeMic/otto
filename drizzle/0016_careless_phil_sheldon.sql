CREATE TABLE "user_channel_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"display_name" text,
	"full_name" text,
	"username" text,
	"avatar_url" text,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolution_source" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_channel_identities" ADD CONSTRAINT "user_channel_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_channel_identities" ADD CONSTRAINT "user_channel_identities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_channel_identities_user_id_organization_id_idx" ON "user_channel_identities" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_channel_identities_organization_id_provider_external_id_idx" ON "user_channel_identities" USING btree ("organization_id","provider","external_id");
CREATE TABLE "billing_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"auto_top_off_enabled" boolean DEFAULT false NOT NULL,
	"minimum_balance_credits" integer DEFAULT 2000 NOT NULL,
	"top_off_amount_cents" integer DEFAULT 2000 NOT NULL,
	"monthly_spend_limit_cents" integer DEFAULT 20000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_preferences" ADD CONSTRAINT "billing_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_preferences_organization_id_idx" ON "billing_preferences" USING btree ("organization_id");
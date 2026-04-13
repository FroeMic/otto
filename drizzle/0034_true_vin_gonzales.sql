CREATE TABLE "billing_auto_top_off_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tenant_id" uuid,
	"status" varchar(64) NOT NULL,
	"trigger_balance_credits_milli" bigint NOT NULL,
	"top_off_amount_cents" integer NOT NULL,
	"credits_granted_milli" bigint NOT NULL,
	"monthly_spend_limit_cents" integer NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"stripe_price_id" varchar(255),
	"stripe_price_lookup_key" varchar(64),
	"stripe_invoice_id" varchar(255),
	"stripe_invoice_item_id" varchar(255),
	"stripe_idempotency_key" varchar(255) NOT NULL,
	"failure_reason" text,
	"processed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_auto_top_off_runs_stripe_idempotency_key_unique" UNIQUE("stripe_idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "billing_auto_top_off_runs" ADD CONSTRAINT "billing_auto_top_off_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_auto_top_off_runs" ADD CONSTRAINT "billing_auto_top_off_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_auto_top_off_runs_organization_id_created_at_idx" ON "billing_auto_top_off_runs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "billing_auto_top_off_runs_organization_id_status_idx" ON "billing_auto_top_off_runs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "billing_auto_top_off_runs_tenant_id_created_at_idx" ON "billing_auto_top_off_runs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_auto_top_off_runs_stripe_invoice_id_idx" ON "billing_auto_top_off_runs" USING btree ("stripe_invoice_id");
CREATE TABLE "billing_checkout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_checkout_session_id" varchar(255) NOT NULL,
	"mode" varchar(64) NOT NULL,
	"status" varchar(64) NOT NULL,
	"plan_key" varchar(64),
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"checkout_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_checkout_sessions_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"default_currency" varchar(16) DEFAULT 'usd' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"stripe_subscription_id" varchar(255) NOT NULL,
	"stripe_price_id" varchar(255),
	"plan_key" varchar(64),
	"status" varchar(64) NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"trial_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" varchar(255) NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "credit_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tenant_id" uuid,
	"source_type" varchar(64) NOT NULL,
	"source_external_id" varchar(255) NOT NULL,
	"plan_key" varchar(64),
	"credits_granted_milli" bigint NOT NULL,
	"expires_at" timestamp with time zone,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ledger_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_ledger_entry_id_credit_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."credit_ledger_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_checkout_sessions_organization_id_created_at_idx" ON "billing_checkout_sessions" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_organization_id_idx" ON "billing_customers" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscriptions_organization_id_idx" ON "billing_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_organization_id_status_idx" ON "billing_subscriptions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "billing_webhook_events_created_at_idx" ON "billing_webhook_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_grants_source_type_external_id_idx" ON "credit_grants" USING btree ("source_type","source_external_id");--> statement-breakpoint
CREATE INDEX "credit_grants_organization_id_granted_at_idx" ON "credit_grants" USING btree ("organization_id","granted_at");--> statement-breakpoint
CREATE INDEX "credit_grants_tenant_id_granted_at_idx" ON "credit_grants" USING btree ("tenant_id","granted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_grants_ledger_entry_id_idx" ON "credit_grants" USING btree ("ledger_entry_id");
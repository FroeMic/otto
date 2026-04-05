CREATE TABLE "credit_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entry_type" varchar(64) NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"source_id" uuid NOT NULL,
	"billable_units" bigint DEFAULT 0 NOT NULL,
	"credits_delta_milli" bigint DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_usage_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_usage_bucket_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_account_id" uuid NOT NULL,
	"settlement_status" varchar(64) NOT NULL,
	"pricing_version" varchar(128) NOT NULL,
	"provider_cost_micros" bigint DEFAULT 0 NOT NULL,
	"billable_units" bigint DEFAULT 0 NOT NULL,
	"credits_burned_milli" bigint DEFAULT 0 NOT NULL,
	"ledger_entry_id" uuid,
	"note" text,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_settlements" ADD CONSTRAINT "provider_usage_settlements_provider_usage_bucket_id_provider_usage_buckets_id_fk" FOREIGN KEY ("provider_usage_bucket_id") REFERENCES "public"."provider_usage_buckets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_settlements" ADD CONSTRAINT "provider_usage_settlements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_settlements" ADD CONSTRAINT "provider_usage_settlements_provider_account_id_provider_accounts_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_settlements" ADD CONSTRAINT "provider_usage_settlements_ledger_entry_id_credit_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."credit_ledger_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_tenant_id_created_at_idx" ON "credit_ledger_entries" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_entries_source_type_source_id_entry_type_idx" ON "credit_ledger_entries" USING btree ("source_type","source_id","entry_type");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_usage_settlements_provider_usage_bucket_id_idx" ON "provider_usage_settlements" USING btree ("provider_usage_bucket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_usage_settlements_ledger_entry_id_idx" ON "provider_usage_settlements" USING btree ("ledger_entry_id");--> statement-breakpoint
CREATE INDEX "provider_usage_settlements_tenant_id_settled_at_idx" ON "provider_usage_settlements" USING btree ("tenant_id","settled_at");--> statement-breakpoint
CREATE INDEX "provider_usage_settlements_provider_account_id_settled_at_idx" ON "provider_usage_settlements" USING btree ("provider_account_id","settled_at");--> statement-breakpoint
CREATE INDEX "provider_usage_settlements_settlement_status_idx" ON "provider_usage_settlements" USING btree ("settlement_status");
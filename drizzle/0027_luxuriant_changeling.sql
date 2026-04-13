CREATE TABLE "provider_usage_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingestion_run_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_account_id" uuid NOT NULL,
	"provider_key" varchar(64) NOT NULL,
	"usage_type" varchar(64) NOT NULL,
	"bucket_key" text NOT NULL,
	"bucket_start_at" timestamp with time zone NOT NULL,
	"bucket_end_at" timestamp with time zone NOT NULL,
	"external_project_id" varchar(255),
	"external_api_key_id" varchar(255),
	"external_user_id" varchar(255),
	"model" text,
	"metrics_json" jsonb NOT NULL,
	"raw_bucket_json" jsonb NOT NULL,
	"raw_result_json" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_usage_ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_run_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_account_id" uuid NOT NULL,
	"provider_key" varchar(64) NOT NULL,
	"usage_type" varchar(64) NOT NULL,
	"status" varchar(64) NOT NULL,
	"requested_start_at" timestamp with time zone NOT NULL,
	"requested_end_at" timestamp with time zone NOT NULL,
	"bucket_width" varchar(16) NOT NULL,
	"group_by_json" jsonb NOT NULL,
	"request_json" jsonb NOT NULL,
	"page_cursor" varchar(255),
	"page_count" integer DEFAULT 0 NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"request_latency_ms" integer,
	"last_error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_usage_buckets" ADD CONSTRAINT "provider_usage_buckets_ingestion_run_id_provider_usage_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."provider_usage_ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_buckets" ADD CONSTRAINT "provider_usage_buckets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_buckets" ADD CONSTRAINT "provider_usage_buckets_provider_account_id_provider_accounts_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_ingestion_runs" ADD CONSTRAINT "provider_usage_ingestion_runs_job_run_id_job_runs_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_ingestion_runs" ADD CONSTRAINT "provider_usage_ingestion_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_ingestion_runs" ADD CONSTRAINT "provider_usage_ingestion_runs_provider_account_id_provider_accounts_id_fk" FOREIGN KEY ("provider_account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_usage_buckets_provider_account_id_bucket_key_idx" ON "provider_usage_buckets" USING btree ("provider_account_id","bucket_key");--> statement-breakpoint
CREATE INDEX "provider_usage_buckets_tenant_id_bucket_start_at_idx" ON "provider_usage_buckets" USING btree ("tenant_id","bucket_start_at");--> statement-breakpoint
CREATE INDEX "provider_usage_buckets_provider_account_id_usage_type_bucket_start_at_idx" ON "provider_usage_buckets" USING btree ("provider_account_id","usage_type","bucket_start_at");--> statement-breakpoint
CREATE INDEX "provider_usage_buckets_external_project_id_external_api_key_id_idx" ON "provider_usage_buckets" USING btree ("external_project_id","external_api_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_usage_ingestion_runs_job_run_id_idx" ON "provider_usage_ingestion_runs" USING btree ("job_run_id");--> statement-breakpoint
CREATE INDEX "provider_usage_ingestion_runs_tenant_id_idx" ON "provider_usage_ingestion_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "provider_usage_ingestion_runs_provider_account_id_idx" ON "provider_usage_ingestion_runs" USING btree ("provider_account_id");--> statement-breakpoint
CREATE INDEX "provider_usage_ingestion_runs_provider_account_id_usage_type_finished_at_idx" ON "provider_usage_ingestion_runs" USING btree ("provider_account_id","usage_type","finished_at");--> statement-breakpoint
CREATE INDEX "provider_usage_ingestion_runs_status_idx" ON "provider_usage_ingestion_runs" USING btree ("status");
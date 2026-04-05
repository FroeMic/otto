delete from "job_events"
where "job_run_id" in (
  select "id"
  from "job_runs"
  where "job_type" = 'ingest_openai_usage'
);
--> statement-breakpoint
delete from "job_runs"
where "job_type" = 'ingest_openai_usage';
--> statement-breakpoint
drop table if exists "provider_usage_buckets" cascade;
--> statement-breakpoint
drop table if exists "provider_usage_ingestion_runs" cascade;
--> statement-breakpoint
create table "provider_usage_sync_states" (
  "id" uuid primary key default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "provider_account_id" uuid not null,
  "usage_type" varchar(64) not null,
  "poll_interval_seconds" integer default 60 not null,
  "last_successful_end_at" timestamp with time zone,
  "last_attempted_at" timestamp with time zone,
  "last_row_count" integer default 0 not null,
  "consecutive_failures" integer default 0 not null,
  "last_error" text,
  "last_error_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
create table "provider_usage_buckets" (
  "id" uuid primary key default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "provider_account_id" uuid not null,
  "usage_type" varchar(64) not null,
  "bucket_start_at" timestamp with time zone not null,
  "bucket_end_at" timestamp with time zone not null,
  "external_api_key_id" varchar(255) default '' not null,
  "model" text default '' not null,
  "item_count" integer,
  "session_count" integer,
  "usage_bytes" bigint,
  "input_tokens" bigint,
  "output_tokens" bigint,
  "input_cached_tokens" bigint,
  "input_uncached_tokens" bigint,
  "input_text_tokens" bigint,
  "output_text_tokens" bigint,
  "input_audio_tokens" bigint,
  "output_audio_tokens" bigint,
  "input_image_tokens" bigint,
  "output_image_tokens" bigint,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
alter table "provider_usage_sync_states" add constraint "provider_usage_sync_states_tenant_id_tenants_id_fk" foreign key ("tenant_id") references "public"."tenants"("id") on delete cascade on update no action;
--> statement-breakpoint
alter table "provider_usage_sync_states" add constraint "provider_usage_sync_states_provider_account_id_provider_accounts_id_fk" foreign key ("provider_account_id") references "public"."provider_accounts"("id") on delete cascade on update no action;
--> statement-breakpoint
alter table "provider_usage_buckets" add constraint "provider_usage_buckets_tenant_id_tenants_id_fk" foreign key ("tenant_id") references "public"."tenants"("id") on delete cascade on update no action;
--> statement-breakpoint
alter table "provider_usage_buckets" add constraint "provider_usage_buckets_provider_account_id_provider_accounts_id_fk" foreign key ("provider_account_id") references "public"."provider_accounts"("id") on delete cascade on update no action;
--> statement-breakpoint
create unique index "provider_usage_sync_states_provider_account_id_usage_type_idx" on "provider_usage_sync_states" using btree ("provider_account_id","usage_type");
--> statement-breakpoint
create index "provider_usage_sync_states_tenant_id_idx" on "provider_usage_sync_states" using btree ("tenant_id");
--> statement-breakpoint
create index "provider_usage_sync_states_provider_account_id_idx" on "provider_usage_sync_states" using btree ("provider_account_id");
--> statement-breakpoint
create index "provider_usage_sync_states_provider_account_id_usage_type_last_attempted_at_idx" on "provider_usage_sync_states" using btree ("provider_account_id","usage_type","last_attempted_at");
--> statement-breakpoint
create index "provider_usage_sync_states_last_error_at_idx" on "provider_usage_sync_states" using btree ("last_error_at");
--> statement-breakpoint
create unique index "provider_usage_buckets_provider_account_id_usage_type_bucket_dims_idx" on "provider_usage_buckets" using btree ("provider_account_id","usage_type","bucket_start_at","bucket_end_at","external_api_key_id","model");
--> statement-breakpoint
create index "provider_usage_buckets_tenant_id_bucket_start_at_idx" on "provider_usage_buckets" using btree ("tenant_id","bucket_start_at");
--> statement-breakpoint
create index "provider_usage_buckets_provider_account_id_usage_type_bucket_start_at_idx" on "provider_usage_buckets" using btree ("provider_account_id","usage_type","bucket_start_at");
--> statement-breakpoint
create index "provider_usage_buckets_external_api_key_id_model_idx" on "provider_usage_buckets" using btree ("external_api_key_id","model");

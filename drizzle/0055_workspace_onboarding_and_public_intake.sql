CREATE TABLE "public_intake_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "prompt" text NOT NULL,
  "source" varchar(128) DEFAULT 'landing' NOT NULL,
  "utm_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "experiment_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(64) DEFAULT 'captured' NOT NULL,
  "converted_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "converted_organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "public_intake_sessions_converted_organization_id_idx"
  ON "public_intake_sessions" ("converted_organization_id");
CREATE INDEX "public_intake_sessions_converted_user_id_idx"
  ON "public_intake_sessions" ("converted_user_id");
CREATE INDEX "public_intake_sessions_status_created_at_idx"
  ON "public_intake_sessions" ("status", "created_at");

CREATE TABLE "workspace_onboarding_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "flow_key" varchar(128) DEFAULT 'workspace_onboarding' NOT NULL,
  "flow_version" integer DEFAULT 1 NOT NULL,
  "status" varchar(64) DEFAULT 'draft' NOT NULL,
  "current_step_key" varchar(128),
  "answers_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "starter_prompt" text,
  "starter_prompt_consumed_at" timestamptz,
  "waitlist_decision" varchar(64) DEFAULT 'pending' NOT NULL,
  "waitlist_reason" text,
  "initial_tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL,
  "initial_provisioning_job_id" uuid,
  "provisioning_started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "workspace_onboarding_runs_organization_id_idx"
  ON "workspace_onboarding_runs" ("organization_id");
CREATE INDEX "workspace_onboarding_runs_status_provisioning_started_at_idx"
  ON "workspace_onboarding_runs" ("status", "provisioning_started_at");
CREATE INDEX "workspace_onboarding_runs_user_id_idx"
  ON "workspace_onboarding_runs" ("user_id");
CREATE UNIQUE INDEX "workspace_onboarding_runs_user_id_organization_id_idx"
  ON "workspace_onboarding_runs" ("user_id", "organization_id");

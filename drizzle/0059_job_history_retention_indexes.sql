CREATE INDEX IF NOT EXISTS "job_runs_job_type_status_finished_at_idx" ON "job_runs" USING btree ("job_type","status","finished_at");

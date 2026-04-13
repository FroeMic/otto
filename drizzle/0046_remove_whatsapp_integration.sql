DELETE FROM "tenant_runtime_config_mutations"
WHERE "tenant_runtime_config_entry_id" IN (
  SELECT "id"
  FROM "tenant_runtime_config_entries"
  WHERE "surface_kind" = 'channel'
    AND "surface_key" = 'whatsapp'
);
--> statement-breakpoint
DELETE FROM "tenant_runtime_config_entries"
WHERE "surface_kind" = 'channel'
  AND "surface_key" = 'whatsapp';
--> statement-breakpoint
DELETE FROM "user_channel_identities"
WHERE "provider" = 'whatsapp';
--> statement-breakpoint
DELETE FROM "job_runs"
WHERE "job_type" IN ('whatsapp_link_session', 'whatsapp_disconnect');
--> statement-breakpoint
DELETE FROM "tenant_integrations"
WHERE "provider_key" = 'whatsapp';
--> statement-breakpoint
DROP TABLE IF EXISTS "integration_whatsapp_link_sessions";
--> statement-breakpoint
DROP TABLE IF EXISTS "integration_whatsapp_installations";

ALTER TABLE "integration_secrets" RENAME TO "integration_credentials";
--> statement-breakpoint
ALTER TABLE "slack_installations" RENAME TO "integration_slack_installations";
--> statement-breakpoint
ALTER TABLE "whatsapp_installations" RENAME TO "integration_whatsapp_installations";
--> statement-breakpoint
ALTER TABLE "whatsapp_link_sessions" RENAME TO "integration_whatsapp_link_sessions";
--> statement-breakpoint
ALTER TABLE "messaging_workspaces" RENAME TO "integration_messaging_workspaces";
--> statement-breakpoint
ALTER TABLE "messaging_workspace_members" RENAME TO "integration_messaging_workspace_members";
--> statement-breakpoint
ALTER TABLE "messaging_conversations" RENAME TO "integration_messaging_conversations";
--> statement-breakpoint
ALTER TABLE "integration_credentials" RENAME CONSTRAINT "integration_secrets_tenant_integration_id_tenant_integrations_id_fk" TO "integration_credentials_tenant_integration_id_tenant_integrations_id_fk";
--> statement-breakpoint
ALTER TABLE "integration_slack_installations" RENAME CONSTRAINT "slack_installations_tenant_integration_id_tenant_integrations_id_fk" TO "integration_slack_installations_tenant_integration_id_tenant_integrations_id_fk";
--> statement-breakpoint
ALTER TABLE "integration_whatsapp_installations" RENAME CONSTRAINT "whatsapp_installations_tenant_integration_id_tenant_integrations_id_fk" TO "integration_whatsapp_installations_tenant_integration_id_tenant_integrations_id_fk";
--> statement-breakpoint
ALTER TABLE "integration_whatsapp_link_sessions" RENAME CONSTRAINT "whatsapp_link_sessions_tenant_integration_id_tenant_integrations_id_fk" TO "integration_whatsapp_link_sessions_tenant_integration_id_tenant_integrations_id_fk";
--> statement-breakpoint
ALTER TABLE "integration_messaging_workspaces" RENAME CONSTRAINT "messaging_workspaces_tenant_integration_id_tenant_integrations_id_fk" TO "integration_messaging_workspaces_tenant_integration_id_tenant_integrations_id_fk";
--> statement-breakpoint
ALTER TABLE "integration_messaging_workspace_members" RENAME CONSTRAINT "messaging_workspace_members_messaging_workspace_id_messaging_workspaces_id_fk" TO "integration_messaging_workspace_members_messaging_workspace_id_integration_messaging_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "integration_messaging_conversations" RENAME CONSTRAINT "messaging_conversations_messaging_workspace_id_messaging_workspaces_id_fk" TO "integration_messaging_conversations_messaging_workspace_id_integration_messaging_workspaces_id_fk";
--> statement-breakpoint
ALTER INDEX "integration_secrets_tenant_integration_id_idx" RENAME TO "integration_credentials_tenant_integration_id_idx";
--> statement-breakpoint
ALTER INDEX "integration_secrets_tenant_integration_id_secret_type_idx" RENAME TO "integration_credentials_tenant_integration_id_secret_type_idx";
--> statement-breakpoint
ALTER INDEX "slack_installations_tenant_integration_id_idx" RENAME TO "integration_slack_installations_tenant_integration_id_idx";
--> statement-breakpoint
ALTER INDEX "whatsapp_installations_tenant_integration_id_idx" RENAME TO "integration_whatsapp_installations_tenant_integration_id_idx";
--> statement-breakpoint
ALTER INDEX "whatsapp_link_sessions_tenant_integration_id_idx" RENAME TO "integration_whatsapp_link_sessions_tenant_integration_id_idx";
--> statement-breakpoint
ALTER INDEX "whatsapp_link_sessions_tenant_integration_id_status_idx" RENAME TO "integration_whatsapp_link_sessions_tenant_integration_id_status_idx";
--> statement-breakpoint
ALTER INDEX "messaging_workspaces_tenant_integration_id_idx" RENAME TO "integration_messaging_workspaces_tenant_integration_id_idx";
--> statement-breakpoint
ALTER INDEX "messaging_workspaces_tenant_integration_id_external_workspace_id_idx" RENAME TO "integration_messaging_workspaces_tenant_integration_id_external_workspace_id_idx";
--> statement-breakpoint
ALTER INDEX "messaging_workspace_members_workspace_id_idx" RENAME TO "integration_messaging_workspace_members_workspace_id_idx";
--> statement-breakpoint
ALTER INDEX "messaging_workspace_members_workspace_id_external_member_id_idx" RENAME TO "integration_messaging_workspace_members_workspace_id_external_member_id_idx";
--> statement-breakpoint
ALTER INDEX "messaging_conversations_workspace_id_idx" RENAME TO "integration_messaging_conversations_workspace_id_idx";
--> statement-breakpoint
ALTER INDEX "messaging_conversations_workspace_id_external_conversation_id_idx" RENAME TO "integration_messaging_conversations_workspace_id_external_conversation_id_idx";

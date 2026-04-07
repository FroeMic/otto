ALTER TABLE "integration_execution_audits" RENAME COLUMN "operation_key" TO "command_key";--> statement-breakpoint
ALTER TABLE "integration_execution_audits" ALTER COLUMN "command_key" TYPE varchar(128);--> statement-breakpoint
ALTER INDEX "integration_execution_audits_integration_key_operation_key_created_at_idx" RENAME TO "integration_execution_audits_integration_key_command_key_created_at_idx";

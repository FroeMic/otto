CREATE TABLE "workspace_chat_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "uploaded_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "storage_key" text NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" varchar(255) NOT NULL,
  "size_bytes" bigint NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "status" varchar(64) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "workspace_chat_attachments_organization_id_idx"
  ON "workspace_chat_attachments" ("organization_id");
CREATE INDEX "workspace_chat_attachments_tenant_id_idx"
  ON "workspace_chat_attachments" ("tenant_id");
CREATE INDEX "workspace_chat_attachments_uploaded_by_user_id_idx"
  ON "workspace_chat_attachments" ("uploaded_by_user_id");
CREATE UNIQUE INDEX "workspace_chat_attachments_storage_key_idx"
  ON "workspace_chat_attachments" ("storage_key");

CREATE TABLE "workspace_chat_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "created_by_user_id" uuid,
  "kind" varchar(64) NOT NULL,
  "visibility" varchar(64) NOT NULL,
  "title" text NOT NULL,
  "slug" varchar(255),
  "latest_message_preview" text,
  "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_chat_conversations_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "workspace_chat_conversations_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "workspace_chat_conversations_created_by_user_id_users_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "workspace_chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "author_kind" varchar(64) NOT NULL,
  "author_user_id" uuid,
  "author_name" text,
  "status" varchar(64) NOT NULL,
  "client_message_id" varchar(255),
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_chat_messages_conversation_id_workspace_chat_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "public"."workspace_chat_conversations"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "workspace_chat_messages_author_user_id_users_id_fk"
    FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "workspace_chat_message_parts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL,
  "ordinal" integer NOT NULL,
  "part_kind" varchar(64) NOT NULL,
  "text_value" text,
  "attachment_id" varchar(255),
  "file_name" text,
  "mime_type" varchar(255),
  "duration_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_chat_message_parts_message_id_workspace_chat_messages_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "public"."workspace_chat_messages"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "workspace_chat_runtime_segments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "tenant_session_id" uuid,
  "session_key" text NOT NULL,
  "external_session_id" text,
  "status" varchar(64) NOT NULL,
  "started_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_chat_runtime_segments_conversation_id_workspace_chat_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "public"."workspace_chat_conversations"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "workspace_chat_runtime_segments_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "workspace_chat_runtime_segments_tenant_session_id_tenant_sessions_id_fk"
    FOREIGN KEY ("tenant_session_id") REFERENCES "public"."tenant_sessions"("id") ON DELETE set null ON UPDATE no action
);

CREATE INDEX "workspace_chat_conversations_organization_id_last_activity_at_idx"
  ON "workspace_chat_conversations" USING btree ("organization_id", "last_activity_at");
CREATE INDEX "workspace_chat_conversations_tenant_id_idx"
  ON "workspace_chat_conversations" USING btree ("tenant_id");
CREATE UNIQUE INDEX "workspace_chat_conversations_organization_id_slug_idx"
  ON "workspace_chat_conversations" USING btree ("organization_id", "slug")
  WHERE "slug" IS NOT NULL;

CREATE INDEX "workspace_chat_messages_conversation_id_created_at_idx"
  ON "workspace_chat_messages" USING btree ("conversation_id", "created_at");
CREATE INDEX "workspace_chat_messages_author_user_id_idx"
  ON "workspace_chat_messages" USING btree ("author_user_id");
CREATE UNIQUE INDEX "workspace_chat_messages_conversation_id_client_message_id_idx"
  ON "workspace_chat_messages" USING btree ("conversation_id", "client_message_id")
  WHERE "client_message_id" IS NOT NULL;

CREATE UNIQUE INDEX "workspace_chat_message_parts_message_id_ordinal_idx"
  ON "workspace_chat_message_parts" USING btree ("message_id", "ordinal");
CREATE INDEX "workspace_chat_message_parts_message_id_idx"
  ON "workspace_chat_message_parts" USING btree ("message_id");

CREATE UNIQUE INDEX "workspace_chat_runtime_segments_conversation_id_session_key_idx"
  ON "workspace_chat_runtime_segments" USING btree ("conversation_id", "session_key");
CREATE INDEX "workspace_chat_runtime_segments_tenant_id_idx"
  ON "workspace_chat_runtime_segments" USING btree ("tenant_id");

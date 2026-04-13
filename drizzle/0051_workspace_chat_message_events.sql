CREATE TABLE "workspace_chat_message_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "message_id" uuid NOT NULL,
  "runtime_segment_id" uuid,
  "session_key" text,
  "run_id" text,
  "sequence" integer NOT NULL,
  "event_type" varchar(128) NOT NULL,
  "item_id" text,
  "status" varchar(64),
  "title" text,
  "summary" text,
  "payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_chat_message_events_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "workspace_chat_message_events_conversation_id_workspace_chat_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "public"."workspace_chat_conversations"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "workspace_chat_message_events_message_id_workspace_chat_messages_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "public"."workspace_chat_messages"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX "workspace_chat_message_events_conversation_id_created_at_idx"
  ON "workspace_chat_message_events" USING btree ("conversation_id", "created_at");
CREATE UNIQUE INDEX "workspace_chat_message_events_message_id_sequence_idx"
  ON "workspace_chat_message_events" USING btree ("message_id", "sequence");
CREATE INDEX "workspace_chat_message_events_message_id_item_id_idx"
  ON "workspace_chat_message_events" USING btree ("message_id", "item_id");

ALTER TABLE "workspace_chat_messages"
  ADD COLUMN "last_stream_sequence" integer DEFAULT 0 NOT NULL;

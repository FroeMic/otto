# Audio Transcript Projection

## Goal

Keep OpenClaw-native audio transcription as the runtime behavior, then project the resulting transcript back into Otto product surfaces.

## Scope

- Parse OpenClaw session JSONL for user audio turns that include workspace chat metadata.
- Extract the workspace chat `message_id` and the transcript text from the session transcript.
- Store the transcript on the existing workspace chat audio message part.
- Show the transcript in workspace chat when available.
- Show the cleaned transcript in the Sessions transcript viewer.

## Architecture

```text
workspace voice note
  -> OpenClaw runtime receives audio
  -> OpenClaw transcribes natively
  -> session JSONL contains Transcript:
  -> session sync callback reaches apps/api
  -> tenant_sessions is upserted
  -> audio transcript is projected to workspace_chat_message_parts.text_value
  -> workspace chat receives a message_upserted event
```

The control plane keeps the durable projection. Runtime session files are an input only.

## Third-Party Surfaces

The parser is source-aware but storage projection is currently workspace-chat-specific because workspace chat message IDs are present in the OpenClaw envelope. Slack and other surfaces should use the same parser shape, then add their own provider-specific projection once their message/attachment IDs are available in the envelope.

## Acceptance Criteria

- Session ingest does not require pre-transcribing audio in the web app.
- Voice-note transcripts can appear in workspace chat after runtime sync.
- Sessions UI shows the transcript text instead of the raw `[Audio]` envelope.
- Existing audio parts without transcripts still render as voice notes.

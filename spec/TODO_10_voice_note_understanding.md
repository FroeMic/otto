# TODO 10: Voice Note Understanding

## Goal

Enable tenant OpenClaw runtimes to understand Slack voice notes by projecting OpenClaw audio transcription config into each tenant runtime, using OpenAI transcription in the first pass.

This should make Slack voice notes behave like normal message input for Otto:

- the runtime transcribes the audio attachment
- the transcript becomes the effective message body
- command parsing and normal agent handling continue to work on the transcript

## Scope

- extend tenant desired state to include audio transcription capability
- render OpenClaw `tools.media.audio` config into tenant `openclaw.json`
- reuse existing runtime OpenAI auth projection for transcription
- update Slack install requirements so the runtime can read Slack-hosted private audio attachments
- add control-plane and runtime verification for the voice-note path
- document the dependency on future shared Slack HTTP ingress preserving attachment behavior

## Dependencies

- `TODO_05_config_apply_and_reconciliation.md`
- `TODO_06_integrations_and_oauth.md`
- current OpenClaw audio docs: <https://docs.openclaw.ai/nodes/audio>
- current OpenClaw Slack docs: <https://docs.openclaw.ai/channels/slack>
- current OpenClaw model provider docs: <https://docs.openclaw.ai/concepts/model-providers>

## Important clarification

This spec is about runtime voice-note understanding, not about finishing the long-term shared Slack ingress architecture.

For the first shipping slice:

- voice-note support can ride on the current runtime Slack path
- the control plane should compile and project the correct OpenClaw audio config now

But the permanent architecture still belongs to `TODO_06_integrations_and_oauth.md`:

- one shared Otto Slack app
- control-plane-owned shared HTTP ingress
- tenant-aware routing behind that ingress

So this spec must not introduce a payload transformation or runtime contract that would make the later `TODO_06` migration harder.

## Decision summary

- Ship v1 with OpenAI transcription only.
- Do not add Whisper CLI or other local audio tooling in the first pass.
- Do not add a tenant-facing toggle in v1; voice-note understanding is enabled by default.
- Do not echo transcripts back into Slack in v1.
- Process only the first audio attachment in v1.
- Request `files:read` in Slack bot scopes so OpenClaw can download Slack-hosted private audio attachments.

## Why this shape

OpenClaw already supports native audio and voice-note transcription through `tools.media.audio`, including OpenAI-backed transcription and command parsing from the resulting transcript.

Otto already projects `RUNTIME_OPENAI_API_KEY` from the control plane into tenant runtime `.env` as `OPENAI_API_KEY`, so the smallest reliable first slice is:

- compile audio transcription defaults into tenant desired state
- render the corresponding `tools.media.audio` block into `openclaw.json`
- ensure Slack installs have the scopes required for attachment download

The Otto custom runtime image currently does not bundle Whisper or other audio CLIs. Adding a CLI fallback now would turn this from a config/apply slice into a runtime packaging and support slice, so that is intentionally deferred.

## Desired-state plan

Extend the internal desired-state JSON compiled into `tenant_desired_states.config_json` with an audio block.

Recommended v1 shape:

- `media.audio.enabled`
- `media.audio.provider`
- `media.audio.model`
- `media.audio.maxBytes`
- `media.audio.echoTranscript`
- `media.audio.attachmentsMode`

Recommended compiled defaults:

- `enabled: true`
- `provider: "openai"`
- `model: "gpt-4o-mini-transcribe"`
- `maxBytes: 20971520`
- `echoTranscript: false`
- `attachmentsMode: "first"`

V1 constraints:

- no provider selection UI
- no transcript echo setting
- no per-channel policy
- no CLI fallback entries in desired state
- no multi-attachment transcription mode

## Runtime projection plan

Extend `web/src/lib/openclaw/config.ts` so tenant runtime config can render an audio section into `openclaw.json`.

The rendered OpenClaw config should include:

- `tools.media.audio.enabled: true`
- `tools.media.audio.maxBytes: 20971520`
- `tools.media.audio.models = [{ provider: "openai", model: "gpt-4o-mini-transcribe" }]`

Runtime auth should continue to use the existing env projection:

- control-plane env: `RUNTIME_OPENAI_API_KEY`
- tenant runtime `.env`: `OPENAI_API_KEY`

Do not add new runtime env vars for v1 audio support.

Do not change the custom runtime image for this slice.

## Slack integration plan

Slack voice-note support depends on the runtime being able to download Slack-hosted private file URLs.

So the Slack install contract should be updated to request `files:read` in the default bot scopes.

Implementation expectations:

- add `files:read` to the default `SLACK_BOT_SCOPES`
- preserve existing Slack behavior for text-only installs
- treat fresh Slack installs as the only supported starting point for this slice

## Shared ingress compatibility plan

`TODO_06_integrations_and_oauth.md` should explicitly preserve voice-note compatibility when Slack moves to shared HTTP ingress.

That follow-on work should assume:

- OpenClaw needs enough Slack attachment metadata to download private audio attachments with the bot token
- the control plane should preserve raw Slack attachment semantics as much as possible
- the v1 voice-note feature should not lock Otto into a custom transformed Slack payload shape

If the control plane later verifies Slack signatures centrally, the forwarded request shape still needs to leave tenant runtime media handling intact.

## Ordered implementation steps

### Step 1. Extend desired state

Deliverables:

- desired-state compiler emits an audio transcription block
- default values are explicit and stable
- malformed or missing future audio config falls back safely

Exit check:

- a compiled tenant desired state includes the expected v1 audio defaults

### Step 2. Render runtime config

Deliverables:

- OpenClaw tenant config type supports audio settings
- `renderOpenClawConfig()` emits `tools.media.audio`
- existing Slack and managed-config rendering stays intact

Exit check:

- rendered `openclaw.json` contains the expected audio transcription configuration

### Step 3. Update Slack scope requirements

Deliverables:

- default Slack bot scopes include `files:read`

Exit check:

- fresh installs have the required scope

### Step 4. Verify apply and runtime behavior

Deliverables:

- apply flow still writes `OPENAI_API_KEY` into tenant `.env`
- apply verification covers the audio config path
- manual runtime validation proves a real Slack voice note is transcribed

Exit check:

- a real Slack voice note under the configured size cap is handled successfully by the tenant runtime

### Step 5. Record the future ingress constraint

Deliverables:

- `TODO_06_integrations_and_oauth.md` notes the raw attachment compatibility requirement
- `spec/STATUS.md` records voice-note support as an active or upcoming slice

Exit check:

- the follow-on Slack ingress work has an explicit regression requirement for voice-note handling

## Acceptance criteria

- tenant desired state includes audio-transcription defaults for Slack-capable runtimes
- rendered tenant `openclaw.json` includes the expected `tools.media.audio` configuration
- rendered tenant `.env` still includes `OPENAI_API_KEY` when `RUNTIME_OPENAI_API_KEY` is configured
- new Slack installs request `files:read`
- a Slack voice note under the configured runtime size cap is transcribed and used as message input
- command parsing continues to work when the original message is a voice note transcript
- no custom runtime-image change is required for the v1 rollout
- the later shared HTTP-ingress work has an explicit requirement to preserve voice-note compatibility

## Status checklist

- [x] define desired-state schema extension for audio transcription
- [x] render OpenClaw audio config into tenant runtime config
- [x] verify existing runtime env projection is sufficient for OpenAI transcription
- [x] add `files:read` to Slack install scope defaults
- [x] surface reconnect-needed state for pre-scope-change Slack installs
- [x] add unit coverage for desired-state compilation and config rendering
- [ ] verify end-to-end Slack voice-note transcription manually
- [x] update `spec/STATUS.md` with progress and dependency notes
- [x] update `TODO_06_integrations_and_oauth.md` with Slack ingress compatibility notes

## Open questions

- Should non-Slack channels opt into voice-note support later, or should each channel be handled as a separate slice?
- When shared Slack HTTP ingress lands, should the control plane raw-proxy requests to tenant runtimes or forward an internally authenticated equivalent that still preserves attachment-download behavior?
- Should a later phase expose tenant controls for transcript echo, size caps, or provider selection?

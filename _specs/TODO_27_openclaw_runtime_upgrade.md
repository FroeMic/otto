# TODO 27: OpenClaw Runtime Upgrade

## Goal

Upgrade the managed tenant runtime baseline from OpenClaw `2026.4.15` to
OpenClaw `2026.4.21` while preserving the custom runtime image, managed
runtime plugins, scheduled-task visibility, session transcript projection, and
OpenAI proxy behavior.

## Working Branch

Planning branch:

```text
plan/openclaw-2026-4-21-upgrade
```

Implementation branch:

```text
codex/openclaw-2026-4-21-upgrade
```

Use the implementation branch for code changes after the planning PR has been
merged. Keep commits small enough to separate:

- spec/status updates
- compatibility fixes
- version bumps
- verification-only follow-ups

## Target Release

- Target upstream runtime image: `ghcr.io/openclaw/openclaw:2026.4.21`
- Target custom image tag: `ghcr.io/froemic/otto-openclaw:2026.4.21.4`
- Rollback image: `ghcr.io/froemic/otto-openclaw:2026.4.15.3`
- Latest verified upstream package signal: `openclaw@2026.4.21`

Do not target upstream `main` for this upgrade. The local OpenClaw checkout has
commits after `v2026.4.21`, but the deployable baseline should remain the
stable release tag unless a specific post-release fix becomes necessary and is
documented here.

## Scope

- Review OpenClaw `2026.4.20` and `2026.4.21` release changes that affect the
  managed runtime.
- Patch repo-owned compatibility gaps before rollout.
- Bump runtime image defaults, custom plugin package versions, and runtime image
  docs.
- Build and validate the custom runtime image locally.
- Canary exactly one tenant runtime before broader rollout.

## Non-Goals

- Do not adopt upstream main-only features in this slice.
- Do not enable managed runtime memory as part of this upgrade; that remains in
  `TODO_26_managed_runtime_memory.md`.
- Do not change the `openai-proxy` provider id.
- Do not broaden runtime provider support beyond the paths currently rendered
  by tenant config.
- Do not add new env vars unless the implementation in this slice consumes
  them.

## Current Implementation State

- `runtime-image/Dockerfile` now defaults to
  `ghcr.io/openclaw/openclaw:2026.4.21`.
- `publish-runtime-image.sh` now defaults to `IMAGE_REVISION=4` and
  `ghcr.io/openclaw/openclaw:2026.4.21`.
- `apps/worker/src/runtime/lib/env.ts` now defaults
  `RUNTIME_OPENCLAW_IMAGE` to the raw upstream `2026.4.21` image.
- Runtime plugin package versions now align with custom image
  `2026.4.21.4`.
- The custom runtime image copies managed plugins into `/app/dist/extensions`,
  which is still the correct packaged image discovery location.
- `runtime-image/helpers/cron-sync-watcher.mjs` now treats `jobs-state.json`
  changes as scheduled-task refresh triggers alongside `jobs.json`.
- A local, unpushed custom image build completed for
  `ghcr.io/froemic/otto-openclaw:2026.4.21.1`, and the image reports
  `OpenClaw 2026.4.21`.
- Session sync is now additive and audio transcript projection depends on
  OpenClaw session JSONL retaining the workspace chat metadata and transcript
  shape.
- Live tenant testing found that OpenClaw `2026.4.21` creates workspace-local
  runtime state under `/home/node/.openclaw/workspace/.openclaw`. Otto now
  pre-creates only `/opt/openclaw/home/workspace/.openclaw` as
  `openclaw:openclaw` mode `770` while keeping the managed workspace root
  `root:openclaw` mode `755`, and the workspace files surface hides `.openclaw`.
- Follow-on tenant testing found two additional compatibility issues:
  OpenClaw now keeps stable cron base session keys alongside per-run
  `...:cron:<job>:run:<run>` keys, and audio transcription can call the
  OpenAI-compatible media provider with a raw control-plane base URL. Otto now
  filters base cron placeholders and empty placeholder sessions from the
  Sessions list, and normalizes raw OpenAI proxy media base URLs to the
  internal `/api/internal/runtime/ai/openai/v1` path before transcription.
  These post-canary fixes are carried by custom image revision
  `ghcr.io/froemic/otto-openclaw:2026.4.21.2`.
- Follow-on audio proxy debugging found OpenAI was receiving a literal
  multipart `model=undefined` on failing automatic media-understanding turns.
  Otto now sanitizes literal missing model values in `otto-ai-provider`, repairs
  invalid audio model fields at the control-plane proxy boundary, and logs
  concise model-repair and upstream-error summaries. These fixes target
  `ghcr.io/froemic/otto-openclaw:2026.4.21.3`.
- Additional live logs showed OpenClaw can pass the active chat model
  `gpt-5.4` into audio transcription. Otto now treats transcription models as a
  separate allowlisted namespace and repairs any non-transcription model to
  `gpt-4o-mini-transcribe` in both the runtime plugin and control-plane proxy.
  These fixes target `ghcr.io/froemic/otto-openclaw:2026.4.21.4`.

## Risk Register

### OpenAI Proxy

Risk: high.

OpenClaw `2026.4.20` changed OpenAI Responses reasoning behavior, `/think`
handling, model-specific reasoning support, Codex routing, native image
defaults, prompt overlays, and stream handling. The managed `openai-proxy`
provider mirrors native OpenAI hooks, but live tenant verification still showed
SSE downstream cancellation before a terminal event.

Mitigation:

- Test `OTTO_OPENAI_PROXY_TRANSPORT=sse`.
- Test `OTTO_OPENAI_PROXY_TRANSPORT=websocket`.
- Test `/think off`, `/think high`, and `/think xhigh`.
- Test tool calls, audio transcription, incomplete stream failure, and terminal
  event logging.

### Cron State Split

Risk: high.

OpenClaw `2026.4.20` split cron runtime execution state into
`jobs-state.json`. Otto now treats `jobs-state.json` as a scheduled-task refresh
trigger alongside `jobs.json` and separately watches `runs/*.jsonl`. Live
tenant canary still needs to confirm that runtime state changes refresh the
workspace scheduled-task surface.

Mitigation:

- Update `runtime-image/helpers/cron-sync-watcher.mjs` to treat
  `jobs-state.json` changes as task refresh triggers.
- Add focused coverage or a direct helper-level verification for the file-name
  handling.
- Canary create/list/edit/run flows and confirm task and run updates arrive in
  the workspace.

### Plugin Loader And Runtime Dependencies

Risk: medium.

OpenClaw tightened synchronous plugin registration, failed-register rollback,
duplicate plugin id precedence, bundled runtime dependency isolation, and
doctor/startup repair behavior. The managed plugins are manifest-backed and
currently have no runtime dependencies, which lowers risk, but the packaged
image path still needs live verification.

Mitigation:

- Verify all managed plugin manifests load from `/app/dist/extensions`.
- Verify startup does not enter repeated runtime dependency repair loops.
- Verify `openclaw plugins inspect` or equivalent gateway/plugin status reports
  include:
  - `otto-ai-provider`
  - `otto-web-provider`
  - `otto-workspace-chat`
  - `otto-managed-config`
  - `otto-managed-skills`
  - `otto-integrations`
  - `otto-session-reporter`

### Workspace Chat Command Ownership

Risk: medium.

OpenClaw `2026.4.21` requires a real owner identity for owner-enforced commands
instead of treating wildcard channel `allowFrom` or empty owner-candidate lists
as sufficient. Workspace chat currently authorizes commands at the inbound
context level, but owner-only command behavior needs explicit verification.

Mitigation:

- Test ordinary slash/native command behavior from workspace chat.
- Test an owner-only command from workspace chat.
- If it fails closed, decide whether workspace chat should project an explicit
  owner identity or leave owner-only commands unavailable from that surface.

### Reused Bundled Channel Plugins

Risk: medium.

Slack, WhatsApp, Discord, and Telegram received channel contract, dependency,
threading, and runtime health changes. Slack also received a useful `threadTs`
preservation fix.

Mitigation:

- Test the reused channels that are enabled in the canary tenant.
- Prioritize Slack threaded outbound sends with `threadTs`.
- Prioritize Slack SecretRef/file-secret outbound sends.
- Confirm any enabled WhatsApp/Discord/Telegram plugin starts cleanly in the
  packaged image.

### Gateway Readiness And WebSocket Scopes

Risk: medium.

OpenClaw changed startup sequencing and websocket broadcast scoping. `/healthz`
may not be enough as the only rollout readiness signal for managed plugin HTTP
routes and sidecars.

Mitigation:

- Keep `/healthz` as the base process check.
- Add canary checks for workspace-chat ingress, bridge status, session reporter,
  and scheduled-task sync.
- Confirm websocket scope tightening does not break workspace-visible activity
  and session events.

### Workspace-Local Runtime State

Risk: high.

Live tenant testing after the first `2026.4.21` rollout showed workspace-chat
turns failing before model execution with:

```text
EACCES: permission denied, mkdir '/home/node/.openclaw/workspace/.openclaw'
```

Otto deliberately keeps `/opt/openclaw/home/workspace` non-writable by the
runtime user so managed bootstrap files cannot be edited directly from the
runtime. OpenClaw now needs a writable workspace-local state directory under
that root.

Mitigation:

- Pre-create `/opt/openclaw/home/workspace/.openclaw` as `openclaw:openclaw`
  mode `770` during tenant runtime permission normalization.
- Keep `/opt/openclaw/home/workspace` owned by `root:openclaw` mode `755`.
- Hide `.openclaw` and its children from the workspace settings/files surface.
- Re-apply tenant config or run the permission normalization path on upgraded
  tenants before re-testing workspace chat.

### Cron Session Projection

Risk: medium.

OpenClaw `2026.4.21` deliberately writes both the stable cron base key and
ephemeral per-run keys for isolated cron runs. Otto previously imported base
rows before the first run and did not hide them once run-specific rows existed,
so the Sessions list could show both:

```text
agent:main:cron:<job>
agent:main:cron:<job>:run:<run>
```

Mitigation:

- Prefer run-specific cron keys over base cron keys during session sync.
- Filter already-synced base cron placeholders from the Sessions list whenever
  a matching run-specific row exists.
- Filter empty placeholder sessions from the Sessions list so failed pre-model
  turns do not show as transcript-less chats.

### Audio Transcription Proxy

Risk: high.

Workspace voice notes reached OpenClaw media-understanding, but transcription
failed with `Audio transcription failed (HTTP 404)`, leaving the model to see
raw media paths and try local Whisper/ffmpeg. The expected path is the
Otto-owned OpenAI audio proxy, not local transcription binaries in the tenant
runtime.

Mitigation:

- Normalize raw control-plane OpenAI proxy base URLs in `otto-ai-provider` to
  `/api/internal/runtime/ai/openai/v1` before the OpenAI-compatible audio
  helper appends `/audio/transcriptions`.
- Publish a new custom runtime image because this fix lives in a runtime
  plugin.
- Re-test workspace voice notes after applying the new image.

### Session Transcript Projection

Risk: medium.

Recent repo changes project audio transcripts from OpenClaw session JSONL into
workspace chat. If OpenClaw changes the user message transcript envelope,
workspace voice-note transcripts may stop projecting even though the turn still
works.

Mitigation:

- Run a workspace voice-note turn against the upgraded runtime.
- Confirm session sync stores transcript JSONL.
- Confirm workspace chat audio message parts receive projected transcript text.
- Confirm the Sessions transcript viewer shows the cleaned transcript.

### Image Generation Defaults

Risk: low.

OpenClaw `2026.4.21` defaults bundled OpenAI image generation to `gpt-image-2`
and advertises larger size hints. This should not affect the managed runtime
unless the bundled OpenAI image provider is enabled or selected.

Mitigation:

- Confirm rendered tenant config keeps intended provider/plugin activation.
- Smoke test image generation only if the canary tenant has that surface
  enabled.

## Implementation Plan

### Phase 0: Planning And Branch Setup

- [x] Pull latest `main`.
- [x] Create `plan/openclaw-2026-4-21-upgrade`.
- [x] Verify latest stable upstream package signal is `2026.4.21`.
- [x] Review local OpenClaw checkout against `v2026.4.15..v2026.4.21`.
- [x] Update this spec with a detailed task checklist and risk register.
- [x] Update `_specs/STATUS.md` with the active upgrade target and next step.

Exit criteria:

- The branch contains a clear upgrade tracker.
- No runtime defaults have changed yet.

### Phase 1: Compatibility Fixes Before Version Bump

- [x] Patch `runtime-image/helpers/cron-sync-watcher.mjs` to queue a task
  refresh when `jobs-state.json` changes.
- [x] Add or update focused verification for the cron watcher filename
  behavior.
- [x] Re-run scheduled-task sync tests.
- [x] Re-run runtime helper or package tests that cover cron sync behavior.

Exit criteria:

- `jobs.json`, `jobs-state.json`, and `runs/*.jsonl` changes all trigger the
  correct sync path.
- Existing scheduled-task sync behavior remains unchanged.

### Phase 2: Mechanical Runtime Baseline Bump

- [x] Update `runtime-image/Dockerfile` to default to
  `ghcr.io/openclaw/openclaw:2026.4.21`.
- [x] Update `publish-runtime-image.sh` defaults:
  - `OPENCLAW_BASE_IMAGE=ghcr.io/openclaw/openclaw:2026.4.21`
  - `IMAGE_REVISION=4`
- [x] Update `apps/worker/src/runtime/lib/env.ts` default
  `RUNTIME_OPENCLAW_IMAGE`.
- [x] Update runtime image docs and examples to `2026.4.21.4`.
- [x] Update all managed runtime plugin package versions to `2026.4.21.4`.
- [x] Update any tests that assert configured/observed runtime image versions.

Exit criteria:

- Repo defaults consistently point at the 2026.4.21 custom image plan.
- Raw upstream default image references are intentional or removed.

### Phase 3: Static And Local Test Gate

- [x] Run managed runtime plugin manifest tests.
- [x] Run `otto-ai-provider` provider contract tests.
- [x] Run `otto-web-provider` tests.
- [x] Run `otto-workspace-chat` tests.
- [x] Run OpenAI proxy tests in `apps/api`.
- [x] Run scheduled-task sync tests.
- [x] Run session sync and audio transcript projection tests.
- [x] Run affected package builds:
  - `apps/api`
  - `apps/worker`
  - `packages/features/runtime-core`

Build note:

- `apps/worker` bundling needed the same `--external ssh2` treatment already
  used by `apps/api` because Bun otherwise tries to bundle `ssh2`'s native
  `cpu-features.node` dependency.

Exit criteria:

- Focused tests pass before building the runtime image.
- Any skipped tests are recorded in this spec with a reason.

### Phase 4: Local Custom Image Build

- [x] Build locally without pushing:

```bash
OPENCLAW_BASE_IMAGE=ghcr.io/openclaw/openclaw:2026.4.21 \
IMAGE_REVISION=1 \
PUSH_IMAGE=0 \
LOAD_IMAGE=1 \
./publish-runtime-image.sh
```

- [x] Confirm the local image tag resolves to
  `ghcr.io/froemic/otto-openclaw:2026.4.21.1`.
- [ ] Start a tenant-like runtime from the local image.
- [ ] Confirm gateway `/healthz` succeeds.
- [x] Confirm managed plugin discovery from `/app/dist/extensions`.
- [ ] Confirm no repeated bundled runtime dependency repair occurs.

Local image verification:

- `docker run --rm --entrypoint openclaw ghcr.io/froemic/otto-openclaw:2026.4.21.1 --version`
  reported `OpenClaw 2026.4.21`.
- A container file inspection found all managed plugin manifests under
  `/app/dist/extensions` and confirmed `/app/otto-helpers/cron-sync-watcher-rules.mjs`
  is packaged.
- The deployable follow-up image is `2026.4.21.4`; publish and tenant canary
  verification are tracked in Phase 9.

Exit criteria:

- The custom image boots locally with managed plugins loaded.

### Phase 5: Provider Canary Matrix

- [ ] `openai-proxy/gpt-5.4` normal text turn over SSE.
- [ ] `openai-proxy/gpt-5.4` normal text turn over WebSocket.
- [ ] `/think off` over selected transport.
- [ ] `/think high` over selected transport.
- [ ] `/think xhigh` over selected transport.
- [ ] Tool-call turn.
- [ ] Audio transcription through `/api/internal/runtime/ai/openai/v1/audio/transcriptions`.
- [ ] Incomplete SSE stream fails instead of producing successful partial
  assistant output.
- [ ] WebSocket stream logs terminal completion or failure.
- [ ] Runtime logs include safe request/stream summaries without prompt text,
  response text, or tenant tokens.

Exit criteria:

- Choose rollout default transport:
  - keep `sse` if WebSocket is not clearly better and verified
  - switch to `websocket` only after explicit live success
- Record the decision in this spec and `STATUS.md`.

Transport decision:

```text
Pending live canary.
```

### Phase 6: Workspace Chat And Session Projection Canary

- [x] Patch live tenant permission regression where OpenClaw `2026.4.21` needs
  workspace-local `.openclaw` state under the protected managed workspace root.
- [x] Hide `.openclaw` from the workspace settings/files surface.
- [x] Filter OpenClaw cron base session placeholders when matching per-run
  session rows exist.
- [x] Filter transcript-less placeholder sessions from the Sessions list.
- [x] Normalize raw OpenAI proxy media base URLs before audio transcription.
- [ ] Workspace chat text turn succeeds.
- [ ] Workspace chat attachment turn succeeds.
- [ ] Workspace chat voice-note turn succeeds.
- [ ] Runtime session sync stores transcript JSONL.
- [ ] Audio transcript projects into the workspace chat message part.
- [ ] Sessions transcript viewer shows the cleaned transcript.
- [ ] Ordinary command from workspace chat behaves as expected.
- [ ] Owner-only command behavior is tested and documented.
- [ ] Workspace chat activity events remain visible after websocket broadcast
  scope changes.

Exit criteria:

- Workspace chat remains usable and recent audio transcript projection still
  works against OpenClaw `2026.4.21`.

Owner-command decision:

```text
Pending live canary.
```

Live canary finding:

```text
Workspace-chat turns initially failed before model execution because the
runtime user could not create /home/node/.openclaw/workspace/.openclaw. The
hotfix keeps the workspace root protected and creates only that state directory
as writable.
```

### Phase 7: Scheduled Tasks Canary

- [ ] Create a scheduled task.
- [ ] List scheduled tasks.
- [ ] Edit a scheduled task.
- [ ] Trigger or wait for one run.
- [ ] Confirm OpenClaw writes expected `jobs.json` content.
- [ ] Confirm OpenClaw writes expected `jobs-state.json` content.
- [ ] Confirm OpenClaw writes expected `runs/*.jsonl` content.
- [ ] Confirm the workspace Scheduled Tasks UI receives refreshed task state.
- [ ] Confirm the workspace Scheduled Tasks UI receives refreshed run state.
- [ ] Test delivery mode `none`.
- [ ] Test announce/direct delivery if configured in the canary tenant.

Exit criteria:

- Scheduled-task config, runtime state, and run history stay visible after the
  OpenClaw cron state split.

### Phase 8: Reused Channel Canary

Run only for channels enabled in the canary tenant.

- [ ] Slack startup succeeds.
- [ ] Slack threaded reply preserves `threadTs`.
- [ ] Slack outbound send works when configured with file/exec SecretRef.
- [ ] WhatsApp startup succeeds if enabled.
- [ ] Discord startup succeeds if enabled.
- [ ] Telegram startup succeeds if enabled.
- [ ] Any channel dependency repair logs are one-time and not repeated on every
  restart.

Exit criteria:

- No enabled bundled channel regresses during startup, auth, or outbound send.

### Phase 9: Publish And Single-Tenant Rollout

- [ ] Publish:

```bash
OPENCLAW_BASE_IMAGE=ghcr.io/openclaw/openclaw:2026.4.21 \
IMAGE_REVISION=4 \
./publish-runtime-image.sh
```

- [ ] Set or confirm:

```text
RUNTIME_OPENCLAW_IMAGE=ghcr.io/froemic/otto-openclaw:2026.4.21.4
```

- [ ] Refresh exactly one tenant runtime:

```bash
bun run tenant:runtime:refresh-image -- <org-slug>
```

- [ ] Observe:
  - one normal turn
  - one tool turn
  - one workspace-chat turn
  - one voice-note transcript projection
  - one scheduled-task run
- [ ] Record canary tenant, image digest, runtime logs reviewed, and outcome.

Exit criteria:

- One tenant runs the upgraded image without critical regressions.

Canary record:

```text
Pending.
```

### Phase 10: Broader Rollout Or Rollback

- [ ] If canary passes, document broader rollout order.
- [ ] If canary fails, set `RUNTIME_OPENCLAW_IMAGE` back to
  `ghcr.io/froemic/otto-openclaw:2026.4.15.3`.
- [ ] Refresh the canary tenant back to the rollback image if needed.
- [ ] Record root cause and follow-up tasks.
- [ ] Update this spec and `_specs/STATUS.md` with the final upgrade decision.

Exit criteria:

- Either the upgrade is ready for broader rollout, or rollback has been tested
  and the blocker is documented.

## Acceptance Criteria

- Custom runtime image builds on top of OpenClaw `2026.4.21`.
- All managed plugins load from the packaged image.
- `openai-proxy/gpt-5.4` works on the selected transport.
- OpenAI proxy incomplete streams fail clearly.
- Scheduled tasks refresh after `jobs.json`, `jobs-state.json`, and run-log
  changes.
- Workspace chat text, attachments, and voice-note transcript projection work.
- Enabled reused channel plugins start and send normally.
- One tenant canary passes before broader rollout.
- Rollback to `2026.4.15.3` remains documented and available.

## Status Checklist

- [x] Review completed.
- [x] Branch created.
- [x] Detailed upgrade tracker written.
- [x] Status file updated.
- [x] Cron `jobs-state.json` compatibility patched.
- [x] Runtime defaults bumped.
- [x] Tests passed.
- [x] Local image built.
- [x] Workspace-local `.openclaw` state permission hotfix added after live
  tenant failure.
- [x] Cron session projection and audio transcription proxy follow-up hotfixes
  added after live tenant testing.
- [ ] Tenant-like local boot verified.
- [ ] Custom image published.
- [ ] Single-tenant canary passed.
- [ ] Broader rollout decision recorded.

## Open Questions

- Should workspace chat project an explicit owner identity for owner-only
  commands, or should owner-only commands remain unavailable from that surface?
- After canary, should generated tenant env keep
  `OTTO_OPENAI_PROXY_TRANSPORT=sse` or switch to `websocket`?
- Are any production tenants currently relying on Slack SecretRef file/exec
  token paths or WhatsApp/Discord/Telegram startup paths that must be included
  in the first canary rather than second-pass channel checks?

# TODO 22: OpenClaw 2026.4.12 Runtime Upgrade

## Goal

Upgrade Otto's managed runtime base from OpenClaw `2026.4.8` to OpenClaw
`2026.4.12` in a controlled way, with plugin packaging normalized first and the
custom Otto runtime image rebuilt, tested, and promoted without production
backward-compatibility constraints.

This repo does not have production traffic yet, so the plan should optimize for
clean forward motion and strong validation rather than elaborate compatibility
shims.

## Scope

- review the OpenClaw `2026.4.12` release for Otto-relevant changes
- identify the concrete Otto-side upgrade risks
- normalize Otto runtime plugin packaging to match newer OpenClaw expectations
- bump the custom runtime image base tag and related defaults/docs
- define the test matrix needed before any shared environment rollout
- define the rollout sequence for local, staging, and first real tenants

## Non-goals

- implementing the entire upgrade in this spec
- adopting new OpenClaw features like `Active Memory`, LM Studio, or Codex as
  part of the same change unless they are needed for compatibility
- changing Otto's product defaults beyond what the runtime upgrade requires
- finishing Otto's missing embeddings proxy work in this spec

## Dependencies

- `TODO_04_runtime_packaging.md`
- `TODO_11_runtime_release_rollout.md`
- `TODO_14_session_history_visibility.md`
- `TODO_16_runtime_ai_provider_proxy.md`
- `TODO_21_managed_runtime_memory.md`

## Release review

### Verified latest release

As of April 13, 2026, the latest GitHub release visible for OpenClaw is:

- `openclaw 2026.4.12`
- tag `v2026.4.12`
- published April 13, 2026

Key release themes relevant to Otto:

- plugin loading now narrows activation around manifest-declared needs
- `Active Memory` is now stable and present in the release
- memory, dreaming, and QMD behavior received several reliability fixes
- new bundled provider families were added, including Codex and LM Studio
- `openclaw update` and startup behavior were hardened

## Current Otto baseline

Otto is still pinned to the OpenClaw `2026.4.8` image in multiple places:

- [runtime-image/Dockerfile](/Users/michaelfrohlich/Repositories/otto-3/runtime-image/Dockerfile:1)
- [runtime-image/README.md](/Users/michaelfrohlich/Repositories/otto-3/runtime-image/README.md:40)
- [web/.env.example](/Users/michaelfrohlich/Repositories/otto-3/web/.env.example:20)
- [web/.env.production.example](/Users/michaelfrohlich/Repositories/otto-3/web/.env.production.example:25)
- [web/src/lib/env.ts](/Users/michaelfrohlich/Repositories/otto-3/web/src/lib/env.ts:27)
- [apps/worker/src/runtime/lib/env.ts](/Users/michaelfrohlich/Repositories/otto-3/apps/worker/src/runtime/lib/env.ts:25)

Otto's custom runtime image currently bundles these runtime plugins:

- `otto-managed-config`
- `otto-managed-skills`
- `otto-integrations`
- `otto-session-reporter`
- `otto-ai-provider`
- `otto-web-provider`

## Risk review

### Main upgrade risk: plugin packaging and activation metadata

The most likely breaking area is not model behavior or memory behavior. It is
plugin loading.

OpenClaw `2026.4.12` explicitly narrows CLI/provider/channel activation to
manifest-declared needs. Otto currently has inconsistent plugin package
metadata:

- `otto-ai-provider` has `package.json` `openclaw.extensions`
- `otto-managed-config` has `package.json` `openclaw.extensions`
- `otto-managed-skills` has `package.json` `openclaw.extensions`
- `otto-integrations` is missing `package.json` `openclaw.extensions`
- `otto-session-reporter` is missing `package.json` `openclaw.extensions`
- `otto-web-provider` has no `package.json` at all today

Even though Otto copies plugin directories directly into `/app/dist/extensions`,
the newer loader and packaged-runtime metadata rules are moving toward stricter,
more explicit package metadata. So the first upgrade step should be to make all
Otto runtime plugins conform to the same modern packaged shape.

### Secondary risk: packaged discovery expectations

Because OpenClaw has kept tightening packaged plugin discovery around:

- `openclaw.plugin.json`
- `package.json`
- `openclaw.extensions`
- manifest-declared contracts

Otto should assume that every bundled runtime plugin must carry:

- a manifest
- a `package.json`
- `package.json` `openclaw.extensions`
- explicit `contracts` whenever the plugin owns a discoverable capability

### Low-risk areas

These are not expected to block the upgrade:

- `openai-proxy` model path
- `openai-proxy` audio transcription path
- Otto-managed config tools
- Otto-managed skills tools
- existing runtime env projection

They still need testing, but nothing in the release notes points to a clear
breaking change for these Otto-owned surfaces.

### Additive features Otto should not adopt during the bump

Do not mix these into the version bump itself:

- `Active Memory`
- LM Studio provider
- Codex provider family
- QMD behavior changes as product defaults

The runtime upgrade should first preserve Otto's current behavior.

## Upgrade decision

Upgrade to OpenClaw `2026.4.12`, but only after a packaging-normalization
preflight for Otto's bundled runtime plugins.

Because nothing is in production yet, do not build a long-lived dual-version
compatibility layer. Fix the packaging cleanly, rebuild the image, validate it,
and then move Otto's defaults and docs forward together.

## Detailed plan

### Phase 0: Preflight and packaging normalization

Goal:

- remove the most likely loader regressions before the base-image bump

Tasks:

1. Normalize every runtime plugin directory to the same packaged shape.
2. Add a `package.json` to `runtime-plugins/otto-web-provider`.
3. Add `openclaw.extensions` to:
   - `runtime-plugins/otto-integrations/package.json`
   - `runtime-plugins/otto-session-reporter/package.json`
4. Confirm all runtime plugins have:
   - `openclaw.plugin.json`
   - `package.json`
   - `type: "module"`
   - `openclaw.extensions: ["./index.js"]`
5. Review manifest `contracts` for completeness:
   - `otto-web-provider` already declares `webSearchProviders`
   - `otto-ai-provider` already declares provider/media contracts
   - `otto-session-reporter` likely remains fine with no tool contract, but
     confirm that its lifecycle-hook-only behavior does not need explicit
     contract metadata for the newer loader/runtime surfaces

Deliverable:

- a metadata-only patch that makes Otto runtime plugins look like first-class
  modern packaged OpenClaw plugins

### Phase 1: Base image and version bump

Goal:

- move the repo's runtime defaults from `2026.4.8` to `2026.4.12`

Tasks:

1. Bump the base image in [runtime-image/Dockerfile](/Users/michaelfrohlich/Repositories/otto-3/runtime-image/Dockerfile:1).
2. Update version mentions in:
   - `runtime-image/README.md`
   - `web/.env.example`
   - `web/.env.production.example`
   - `web/src/lib/env.ts`
   - `apps/worker/src/runtime/lib/env.ts`
   - any tests or docs that assert `2026.4.8`
3. Update `spec/STATUS.md` and any rollout notes that mention `2026.4.8` as the
   current aligned upstream runtime release.

Deliverable:

- the custom Otto runtime image now builds on `ghcr.io/openclaw/openclaw:2026.4.12`

### Phase 2: Local validation

Goal:

- prove that Otto's bundled runtime plugins still load and Otto's critical
  runtime paths still work

Required local checks:

1. Build the custom runtime image locally.
2. Boot a tenant-like runtime from the custom image.
3. Verify plugin discovery for:
   - `otto-managed-config`
   - `otto-managed-skills`
   - `otto-integrations`
   - `otto-session-reporter`
   - `otto-ai-provider`
   - `otto-web-provider`
4. Validate these Otto behaviors end to end:
   - managed config tools appear and execute
   - managed skills tools appear and execute
   - integrations tool surface appears and can list available integrations
   - `openai-proxy` responses work
   - `openai-proxy` audio transcription still works
   - web search proxy still works
   - session reporter still emits transcript/session callbacks
5. Verify that the newer placeholder-auth hardening does not break Otto-managed
   local runs that render real runtime tokens.

Recommended command-level validation areas:

- plugin inspection
- gateway boot
- one tool call per Otto plugin surface
- one inference run
- one audio transcription run
- one transcript sync event

Deliverable:

- one repeatable local validation checklist with pass/fail notes

### Phase 3: Repo-side regression coverage

Goal:

- raise confidence before any shared environment rollout

Tasks:

1. Expand or add focused tests around rendered runtime config so the newer
   OpenClaw release cannot silently break Otto's plugin allowlists.
2. Add assertions that Otto plugin directories contain the required packaged
   metadata.
3. Add a smoke test or scripted check for the custom runtime image if practical.
4. Verify no Otto code still assumes `2026.4.8`-specific runtime behavior.

Priority test targets:

- `web/src/lib/openclaw/config.test.ts`
- `apps/worker/src/runtime/lib/openclaw/config.ts` and its tests
- runtime image build/test helpers
- any plugin packaging checks we can automate

Deliverable:

- focused regression coverage for the upgrade's likely failure points

### Phase 4: Staging / first shared environment rollout

Goal:

- validate the new image in an environment closer to real tenancy

Tasks:

1. Publish a new Otto custom runtime image tag based on `2026.4.12`.
2. Apply it to one test tenant or first shared environment.
3. Re-run the critical validation matrix:
   - gateway health
   - managed config tools
   - managed skills tools
   - integration discovery
   - `openai-proxy` model response
   - audio transcription
   - web search proxy
   - session reporter callback
4. Inspect observed runtime image version through Otto's operator surfaces to
   ensure the upgraded image actually landed.

Deliverable:

- one verified canary tenant on the `2026.4.12`-based Otto image

### Phase 5: Make `2026.4.12` the new repo baseline

Goal:

- stop treating the upgrade as a canary and align the repo around the new
  baseline

Tasks:

1. Update docs and deployment defaults to the new Otto custom image tag.
2. Update planning docs that still describe `2026.4.8` as the aligned release.
3. Use the new runtime base for all further memory and AI proxy work.

Deliverable:

- `2026.4.12` becomes Otto's new assumed upstream runtime baseline

## Validation checklist

### Must-pass before merging the bump

- custom Otto runtime image builds on top of `2026.4.12`
- all Otto runtime plugins are discovered and loaded
- `openai-proxy` inference works
- `openai-proxy` audio transcription works
- managed config plugin works
- managed skills plugin works
- integrations plugin works
- session reporter still syncs

### Should-pass before publishing the new image

- web search proxy works
- plugin inspection metadata looks correct in the runtime
- no placeholder gateway credentials remain in any local/staging runtime env
- no startup warnings indicate plugin manifest/activation mismatch

## Acceptance criteria

- Otto no longer references OpenClaw `2026.4.8` as the active runtime baseline
- Otto's custom runtime image is rebuilt on `2026.4.12`
- all Otto runtime plugins follow one consistent modern package/manifest shape
- the key Otto runtime workflows validate locally and on one canary tenant
- the upgrade does not force product-default adoption of new OpenClaw features
  like `Active Memory`

## Status checklist

- [x] review the latest OpenClaw release notes relevant to Otto
- [x] identify Otto-specific breaking-risk areas
- [x] choose the upgrade approach
- [ ] normalize runtime plugin package metadata
- [ ] bump the custom runtime image base to `2026.4.12`
- [ ] update docs and env defaults
- [ ] run local validation
- [ ] add focused regression coverage
- [ ] publish canary Otto runtime image
- [ ] verify one upgraded tenant/runtime

## Open questions

- Does `otto-session-reporter` need any explicit manifest contract metadata for
  newer lifecycle/plugin discovery paths, or is its hook-only runtime behavior
  already sufficient?
- Should Otto add an automated repo check that every bundled runtime plugin has
  `package.json` plus `openclaw.extensions`, so future OpenClaw upgrades cannot
  regress on packaging shape again?
- Should the first canary also include the future embeddings-proxy work, or
  should the base runtime bump land first and keep memory changes separate?

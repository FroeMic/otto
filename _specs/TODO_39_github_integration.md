# TODO 39: GitHub Integration

## Goal

Add GitHub as a workspace-managed integration that lets Otto discover selected repositories, check them out into a tenant runtime worktree, move code between the local filesystem and GitHub, and manage pull requests through the existing managed integration runtime surface.

The integration should use a GitHub App installation model, not personal access tokens and not a generic user OAuth token, because Otto needs repository-scoped permissions, selected-repository installs, server-to-server execution, and installation webhooks without projecting GitHub credentials into tenant runtimes.

## Scope

- Add a GitHub provider definition under the managed integrations framework.
- Add a platform-owned GitHub App configuration and workspace installation lifecycle.
- Store workspace-bound GitHub App installation metadata and selected repository state in the control plane.
- Mint short-lived GitHub installation access tokens in the control plane or gateway when executing integration commands.
- Add runtime commands for repository discovery/checkout, remote fetch/pull/push, remote branch operations, and pull-request lifecycle.
- Add a controlled repository checkout and pull-request workflow so Otto can clone selected repositories, edit/test code in a tenant runtime worktree, push a branch, and create a pull request.
- Defer GitHub issues until the repository, remote, branch, and pull-request workflow is complete.
- Add webhook ingestion for installation and repository events after the install/read surface is stable.
- Keep all commands exposed through the existing `otto-integrations` runtime metatool pattern.

## Non-Goals

- Do not add a raw arbitrary GitHub API proxy.
- Do not project GitHub App private keys, installation tokens, or user tokens into tenant runtime env.
- Do not use user personal access tokens as the primary connection mechanism.
- Do not clone repositories into tenant runtimes before the GitHub App install lifecycle, repository allowlists, token handling, and checkout safety model are implemented.
- Do not support force pushes, repository deletion, Actions secrets, environment secrets, or workflow file mutation in the first implementation.
- Do not let the model construct authenticated Git remotes or print GitHub installation tokens in shell commands, logs, session transcripts, or workspace files.
- Do not require GitHub Enterprise Server support in the first slice. Leave the API base URL abstracted enough to add it later.
- Do not make GitHub webhooks drive autonomous workspace behavior until webhook verification, dedupe, and event storage are in place.

## Dependencies

- `_specs/TODO_17_managed_integrations_architecture.md`
- `_specs/TODO_19_oauth_connected_accounts_substrate.md`
- Existing `packages/features/integrations-runtime` registry, execution framework, audit model, and capability state model.
- Existing `apps/api` integration setup and workspace settings surfaces.
- Existing `apps/gateway` integration execute path.

GitHub App behavior should follow current GitHub platform contracts:

- Installation access tokens are generated from a GitHub App JWT, are sent as bearer tokens to REST or GraphQL requests, and expire after one hour.
- Installation access tokens can be further scoped to repositories and permissions, but cannot exceed what the installation was granted.
- GitHub App permissions determine both API access and subscribed webhook availability.
- GitHub setup URLs include an `installation_id`, but that parameter is not sufficient proof that the current user owns the installation. The callback must verify the installation before binding it to a workspace.
- Webhooks must be validated with `X-Hub-Signature-256` using the configured webhook secret and the exact raw request body.

References:

- GitHub Apps installation auth: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
- GitHub App permissions: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app
- GitHub App setup URL: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url
- GitHub webhook validation: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

## Decision Summary

- Model GitHub as a `workspace_managed` hybrid integration.
- Use a platform-owned GitHub App as the primary auth model.
- Use GitHub App installation access tokens for command execution.
- Add user OAuth only as an optional later layer for installer verification, user attribution, or user-scoped actions.
- Store installation metadata and selected repository cache in control-plane tables tied to `tenant_integrations`.
- Keep short-lived installation tokens server-side and prefer mint-on-demand with an in-memory or expiry-bounded cache.
- Use repository allowlists before executing any repo-specific command.
- Treat checkout, remote push/pull, remote branch operations, and pull-request lifecycle as the first-class target workflow.
- Do not add command-level `confirm` or `changeReason` gates in the first implementation. Normal model/tool approval and runtime permissions are the control layer for now.
- Keep hard safety boundaries in code: selected repositories only, no arbitrary hosts, no token leakage, and no paths outside the managed checkout root.

## Product Model

In workspace settings, a user connects GitHub by installing Otto's GitHub App into a GitHub user account or organization and selecting repositories.

After setup, the integration detail page should show:

- connected GitHub account or organization
- installation status
- repository selection mode, either all repositories or selected repositories
- cached selected repository list
- enabled command groups
- webhook health after webhook support is added

At runtime, Otto should discover GitHub commands through the managed integration tools. If GitHub is not connected or the requested repository is not selected, Otto should surface a connect or permission-repair action instead of inventing a workaround.

## Architecture

### Provider Package

Add GitHub under:

- `packages/features/integrations-runtime/src/integrations/library/github/definition.ts`
- `packages/features/integrations-runtime/src/integrations/library/github/client.ts`
- `packages/features/integrations-runtime/src/integrations/library/github/auth.ts`
- `packages/features/integrations-runtime/src/integrations/library/github/commands/*.ts`
- `packages/features/integrations-runtime/src/integrations/library/github/webhooks.ts`

Register it from the existing integration registry.

The provider definition should include:

- `id: "github"`
- `managementMode: "workspace_managed"`
- runtime command groups for `repositories`, `issues`, `pull_requests`, `checks`, `actions`, `contents`, and later `webhooks`
- an auth binding that resolves a GitHub App installation, not an OAuth token or API key
- setup metadata that points users to the GitHub App install flow

The current integration framework only resolves `api_key` and `oauth` auth bindings. GitHub should add a focused new binding kind instead of overloading OAuth:

```ts
type IntegrationAuthBinding =
  | ExistingApiKeyBinding
  | ExistingOauthBinding
  | { kind: "github_app_installation" };
```

If the framework needs a provider-neutral shape, name the kind `app_installation` and let GitHub be the first implementation.

### Control-Plane API

Add thin HTTP adapters in `apps/api` for:

- starting GitHub App install for a workspace
- receiving the GitHub setup callback
- verifying and binding an installation to the current workspace
- refreshing installation and repository metadata
- disconnecting or disabling the workspace integration
- receiving GitHub App webhooks after webhook support is enabled

The setup callback must not trust `installation_id` alone. It should bind the install request to a workspace/user state token, then verify the installation through GitHub App APIs before storing it.

### Gateway Execution

The gateway should continue to call `executeRegisteredIntegrationCommand`. GitHub-specific command execution should:

- resolve the workspace's enabled `tenant_integration`
- resolve the matching GitHub installation
- validate owner/repo against selected repositories and workspace policy
- mint or reuse a short-lived installation access token
- execute the typed GitHub command
- return a bounded, normalized response
- write the normal integration audit event

### Tenant Runtime

Tenant runtimes should receive no GitHub credentials. Runtime tools only call the integration gateway through existing runtime-authenticated integration execution paths.

For code-editing workflows, tenant runtimes may receive a prepared local worktree, but not reusable GitHub credentials. Checkout and push credentials should be brokered through short-lived GitHub App installation tokens and a controlled helper path that keeps tokens out of model-authored commands, Git remotes, logs, and session transcripts.

Recommended runtime shape:

- create a dedicated writable repository root such as `/home/node/.openclaw/repos`
- keep it separate from managed personalization files and package-managed skill files
- clone selected repositories into deterministic paths under that root
- write a per-operation temporary credential helper or askpass helper outside the visible repo
- clear helper env/config after each operation
- reject authenticated remotes that embed tokens
- enforce repository allowlists before clone, fetch, push, or pull-request operations
- clean stale worktrees by policy once no active session depends on them

### Web UI

Add the workspace settings surface under the existing `Agent > Integrations` area. The first UI should support:

- connect
- reconnect
- disconnect
- refresh repositories
- select or disable repositories if the app installation grants broader access than the workspace wants Otto to use
- show command groups and write safety status

## Data And State

Use the generic integration tables for installed/enabled state and add GitHub-specific tables for installation details and repository cache.

Proposed tables:

### `integration_github_installations`

- `id`
- `tenant_integration_id`
- `tenant_id`
- `installation_id`
- `account_id`
- `account_login`
- `account_type`
- `app_id`
- `app_slug`
- `repository_selection`
- `permissions_json`
- `events_json`
- `suspended_at`
- `connected_at`
- `last_synced_at`
- `last_webhook_at`
- `created_at`
- `updated_at`

Constraints:

- unique `tenant_integration_id`
- unique pair of `tenant_id`, `installation_id`

### `integration_github_repositories`

- `id`
- `github_installation_id`
- `github_repository_id`
- `owner_login`
- `name`
- `full_name`
- `private`
- `default_branch`
- `archived`
- `disabled`
- `selected_by_installation`
- `enabled_for_workspace`
- `last_synced_at`
- `created_at`
- `updated_at`

Constraints:

- unique pair of `github_installation_id`, `github_repository_id`
- indexed `full_name`

### Secrets And Config

Platform config should hold:

- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_WEBHOOK_SECRET`
- optional `GITHUB_API_BASE_URL` later for GitHub Enterprise Server

Do not persist installation access tokens unless a later performance issue proves a need. If cached, cache only with expiry and redaction, and never project them to tenant runtime files or env.

## Permission Model

Start with minimum useful read permissions:

- Metadata: read
- Contents: read
- Issues: read
- Pull requests: read
- Checks: read
- Actions: read
- Commit statuses: read, if needed for status checks

Add write permissions only when the corresponding command slice is implemented:

- Issues: write for issue create, update, label, close, and comment commands.
- Pull requests: write for PR comments or review comments.
- Contents: write for branch creation and commit pushes only when the code workspace workflow is implemented and repository allowlists are enforced.
- Workflows: write should stay out of scope unless Otto intentionally edits workflow files.
- Administration should stay out of scope unless a later spec justifies it.

When app permissions are expanded, installed organizations may need to approve new permissions before Otto can use them. The integration detail page should surface permission drift as a repair state.

## Command Design

Expose commands through the existing managed integration command registry. Use explicit arguments instead of natural-language path parsing.

The GitHub integration command boundary is intentionally narrow:

- GitHub commands cover operations that cross between the local runtime filesystem and GitHub, or operations that require GitHub API state.
- Local-only work stays local after checkout: file edits, `git status`, `git log`, `git diff`, `git add`, `git commit`, and `git reset`.
- The command catalog must not advertise placeholders. A command is exposed only when its executor and tests land in the same slice.
- Do not require command-level `confirm` or `changeReason` gates in the first implementation. Normal model/tool approval and runtime permissions are the control layer for now.
- Keep hard safety boundaries in code: selected repositories only, no arbitrary hosts, no token leakage, and no paths outside the managed checkout root.

### Repository Command Group

Repository commands own selected-repository discovery and checkout.

- `repository.list`
- `repository.get`
- `repository.search`
- `repository.checkout`

Repository command constraints:

- require an enabled repository selected for the workspace
- create worktrees only under the dedicated runtime repository root
- never expose a raw installation token to the model
- never store an authenticated remote URL containing a token
- reject checkout for repos outside the workspace allowlist

### Remote Command Group

Remote commands own network git operations between the checked-out worktree and GitHub.

- `remote.fetch`
- `remote.pull`
- `remote.push`

Remote command constraints:

- operate only inside managed GitHub checkout roots
- use short-lived GitHub App installation credentials without exposing tokens
- never store an authenticated remote URL containing a token
- reject repos outside the workspace allowlist
- run `remote.pull` in fast-forward-only mode by default

### Branch Command Group

Branch commands own remote branch discovery and branch lifecycle operations that need GitHub credentials.

- `branch.list_remote`
- `branch.get_remote`
- `branch.checkout_remote`
- `branch.publish`
- `branch.delete_remote`

Branch command constraints:

- `branch.checkout_remote` creates a local tracking branch from `origin/<branch>`
- `branch.publish` pushes a local branch to GitHub and sets upstream
- reject protected branch deletion unless a later admin policy explicitly allows it
- audit checkout, publish, and delete separately

### Pull Request Command Group

Pull request commands own PR metadata, review activity, and merge lifecycle.

- `pull_request.list`
- `pull_request.get`
- `pull_request.list_files`
- `pull_request.list_reviews`
- `pull_request.list_comments`
- `pull_request.list_checks`
- `pull_request.create`
- `pull_request.update`
- `pull_request.close`
- `pull_request.reopen`
- `pull_request.mark_ready_for_review`
- `pull_request.convert_to_draft`
- `pull_request.comment`
- `pull_request.update_comment`
- `pull_request.delete_comment`
- `pull_request.request_review`
- `pull_request.submit_review`
- `pull_request.merge`

Pull request command constraints:

- create pull requests from branches that are available on GitHub
- support explicit merge method values only: `merge`, `squash`, or `rebase`
- return base branch, head branch, diff summary, checks summary, provider URL, and provider object id
- propagate exact GitHub merge failure messages for checks, reviews, conflicts, permissions, stale branches, and branch protection
- audit PR create, update, close, reopen, comment, review request, review submission, and merge separately
- do not expose a `pull_request.delete` command because GitHub pull requests are closed, not deleted; use `pull_request.close` plus `branch.delete_remote` for source branch cleanup

### Deferred Issue Command Group

Issue commands are intentionally not part of v1.

### Later Commands

These require a separate safety review:

- force push
- repository deletion or archive
- workflow dispatch
- repository dispatch
- Actions rerun/cancel
- Actions secrets or environment mutations

## Webhook Design

Add webhooks after the installation and read command surface is stable.

Initial event classes:

- `installation`
- `installation_repositories`
- `repository`
- `issues`
- `issue_comment`
- `pull_request`
- `pull_request_review`
- `pull_request_review_comment`
- `check_run`
- `check_suite`
- `workflow_run`
- `push`

Webhook route requirements:

- read the exact raw request body
- verify `X-Hub-Signature-256`
- dedupe by `X-GitHub-Delivery`
- record event metadata and normalized entity references
- update installation and repository cache for installation events
- do not trigger autonomous behavior until explicit trigger/workflow policy exists

## Safety And Privacy

- Treat repository content as sensitive workspace data.
- Keep GitHub credentials server-side only.
- Redact tokens, private keys, webhook secrets, and raw authorization headers from logs.
- Store audit metadata, not raw file contents or full webhook payloads, unless a command explicitly needs a durable provider artifact.
- Apply repository allowlists before every command.
- Keep command output bounded to avoid dumping large private files or diffs into sessions.
- Use clear user-facing repair states for missing permissions, suspended installations, removed repositories, and disconnected installs.
- Keep repository-admin destructive actions out of the first implementation, and keep code-mutating actions behind selected-repository allowlists plus explicit confirmation.

## Phase Plan

### Phase 0: App And Framework Foundation

- Create the GitHub App in GitHub.
- Add platform env/config validation for GitHub App credentials.
- Add GitHub installation auth binding to the integration framework.
- Add database migration and metadata projection helpers for GitHub installations and repositories.
- Add focused unit tests for auth binding resolution and repository allowlist checks.

### Phase 1: Install Lifecycle And Repository Inventory

- Add GitHub integration definition and registry entry.
- Add connect/reconnect/disconnect routes.
- Add setup callback handling with workspace state validation and installation verification.
- Add repository sync from GitHub installation APIs.
- Add workspace integration UI for connected account, repo list, refresh, disconnect, and repair states.
- Verify no GitHub credentials are written to tenant runtime config.

### Phase 2: Runtime Command Auth And Repository Commands

- Remove all placeholder GitHub commands from the advertised runtime surface.
- Add GitHub App installation auth resolution to command execution.
- Add `repository.list`, `repository.get`, `repository.search`, and `repository.checkout`.
- Add command schema tests and execution tests with mocked GitHub API responses for each command as it lands.
- Add rate-limit and permission-error normalization.
- Add runtime smoke tests through `find_integration_commands` and `execute_integration_command`.
- Verify runtime command discovery only exposes commands with real executors.

### Phase 3: Remote And Branch Workflow

- Add a tenant runtime repository root with clear ownership and cleanup policy.
- Add `remote.fetch`, `remote.pull`, and `remote.push` helpers that use short-lived installation tokens without leaking them to commands, remotes, logs, or transcripts.
- Add `branch.list_remote`, `branch.get_remote`, `branch.checkout_remote`, `branch.publish`, and `branch.delete_remote`.
- Add runtime smoke tests that clone a selected test repo, edit a file, run local git commands, commit locally, and push a branch.
- Canary against one selected test repo before enabling this for normal workspaces.

### Phase 4: Pull Request Workflow

- Add pull request list/get/files/reviews/comments/checks reads.
- Add pull request create/update/close/reopen/draft-state/comment/update-comment/delete-comment/review-request/submit-review commands.
- Add pull request merge with required-check handling, merge method selection, and exact GitHub failure propagation.
- Add capability defaults and workspace toggles for PR write and merge groups.
- Add audit assertions for every PR write command.
- Add runtime smoke tests that create a draft PR from an assistant-created branch, update it, mark it ready, close/reopen it, and merge only in a disposable test repo.

### Phase 5: Deferred Issue Workflow

- Revisit issue commands after the code workflow is usable end to end.

### Phase 6: Webhook Ingress

- Add raw-body HMAC verification.
- Add delivery dedupe and event metadata storage.
- Handle installation and repository events to keep cache fresh.
- Add issue, PR, checks, workflow, and push normalization without autonomous actions.
- Surface webhook health in the integration UI.

### Phase 7: Optional User OAuth And Enterprise Support

- Add GitHub App user authorization only if needed for installer verification, user attribution, or user-scoped actions.
- Add GitHub Enterprise Server base URL support if customer demand appears.
- Add higher-risk repository write workflows only behind a separate spec.

## Acceptance Criteria

- A workspace admin can connect GitHub by installing Otto's GitHub App.
- The setup callback verifies the installation before binding it to the workspace.
- The integration detail page shows the connected GitHub account and selected repository inventory.
- Runtime command discovery lists only GitHub commands with real executors.
- A repository command can list, get, search, and check out enabled repositories.
- Commands reject repositories outside the selected workspace allowlist.
- No GitHub secrets or installation tokens appear in tenant runtime env, tenant runtime files, logs, or session transcripts.
- Otto can check out an enabled repository into a dedicated runtime repo root, make code edits and commits through normal runtime tools, push a branch without exposing credentials, and create a pull request.
- Repository, remote, branch, and pull-request command groups cover the normal lifecycle: checkout, fetch, pull, push, remote branch listing, remote checkout, branch publish/delete, create PR, update PR, close/reopen PR, mark draft/ready, comment, request review, and merge.
- Permission, suspension, and disconnected-install failures return repairable integration errors.
- Webhook support verifies signatures and dedupes deliveries before processing events.
- Relevant unit/integration tests pass for auth binding, install callback verification, repository allowlists, command execution, checkout/pull/push token safety, PR creation/update/close/merge, branch deletion safety, and webhook signature verification.

## Open Questions

- Should repository selection mirror GitHub's installation selection only, or should Otto maintain an additional workspace-level repository allowlist?
- Should code worktrees live under a user-visible workspace folder or under an operator/runtime-only repository root with explicit UI links back to GitHub?
- Should the first pull-request workflow create draft PRs by default?
- Should pull-request merge be disabled by default until a workspace explicitly enables the merge capability?
- Is GitHub App user OAuth required in Phase 1 to verify the setup callback robustly, or can installation verification be safely completed through app APIs plus signed workspace state?
- Should webhook event storage keep only normalized metadata, or should selected raw payloads be retained for debugging with a short TTL?
- Which GitHub rate-limit and secondary-rate-limit backoff policy should the integration framework standardize for provider commands?
- Should GitHub Enterprise Server support be planned before or after webhook support?

## Status Checklist

- [x] Integration model selected: GitHub App installation.
- [x] Risk and phase plan documented.
- [x] Placeholder runtime commands removed from the advertised catalog.
- [ ] Runtime command catalog registered with real executors only.
- [x] GitHub App installation-token helper added.
- [ ] GitHub App operator configuration created.
- [x] Framework auth binding added.
- [x] Database migration added.
- [x] Install lifecycle implemented.
- [x] First repository inventory projection implemented.
- [ ] Repository selection management UI implemented.
- [ ] Repository command group implemented.
- [ ] Remote command group implemented.
- [ ] Branch command group implemented.
- [ ] Pull-request command group implemented.
- [ ] Runtime repository checkout implemented.
- [ ] Remote push implemented.
- [ ] Remote branch delete implemented.
- [ ] Pull-request create/update/close/reopen implemented.
- [ ] Pull-request merge implemented.
- [ ] Safe write command surface implemented.
- [ ] Webhook ingress implemented.
- [ ] Production canary completed.

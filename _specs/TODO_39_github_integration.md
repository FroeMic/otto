# TODO 39: GitHub Integration

## Goal

Add GitHub as a workspace-managed integration that lets Otto inspect and safely act on selected repositories, issues, pull requests, checks, workflow runs, and repository metadata through the existing managed integration runtime surface.

The integration should use a GitHub App installation model, not personal access tokens and not a generic user OAuth token, because Otto needs repository-scoped permissions, selected-repository installs, server-to-server execution, and installation webhooks without projecting GitHub credentials into tenant runtimes.

## Scope

- Add a GitHub provider definition under the managed integrations framework.
- Add a platform-owned GitHub App configuration and workspace installation lifecycle.
- Store workspace-bound GitHub App installation metadata and selected repository state in the control plane.
- Mint short-lived GitHub installation access tokens in the control plane or gateway when executing integration commands.
- Add read-oriented runtime commands for repositories, issues, pull requests, commits, files, checks, and workflow runs.
- Add a controlled repository checkout and pull-request workflow so Otto can clone selected repositories, edit/test code in a tenant runtime worktree, push a branch, and create a pull request.
- Add a first safe issue/PR metadata write command set only after the read surface and installation lifecycle are verified.
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
- Use repository allowlists and command capability states before executing any repo-specific command.
- Treat checkout, branch push, and pull-request creation as a first-class target workflow, but put it behind a dedicated code workspace safety layer instead of exposing raw Git credentials to the model.
- Keep writes narrow and explicit, with command-specific confirmation inputs and change reasons.

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

### Phase 1 Read Commands

- `repository.list`
- `repository.get`
- `repository.search`
- `issue.search`
- `issue.get`
- `issue.list_comments`
- `pull_request.search`
- `pull_request.get`
- `pull_request.list_files`
- `pull_request.list_reviews`
- `check.list_for_ref`
- `workflow_run.list`
- `workflow_run.get`
- `commit.list`
- `commit.get`
- `content.get_file`

Read command constraints:

- require `owner` and `repo` for repo-scoped calls
- reject repos not enabled for the workspace
- bound page sizes and returned body size
- summarize or truncate large file diffs and file contents
- include provider URLs for user inspection

### Repository Command Group

Repository commands own selected-repository discovery and local runtime worktree lifecycle.

Read commands:

- `repository.list`
- `repository.get`
- `repository.search`
- `repository.list_tree`
- `repository.get_file`
- `repository.compare`

Runtime worktree commands:

- `repository.checkout`
- `repository.fetch`
- `repository.pull`
- `repository.status`
- `repository.diff`
- `repository.commit`
- `repository.cleanup_worktree`

Repository command constraints:

- require an enabled repository selected for the workspace
- create worktrees only under the dedicated runtime repository root
- never expose a raw installation token to the model
- never store an authenticated remote URL containing a token
- reject clone/fetch/pull/push operations for repos outside the workspace allowlist
- run `repository.pull` in fast-forward-only mode by default
- require a clean or explicitly acknowledged dirty worktree before pull
- require `confirm: true` and `changeReason` before `repository.commit`
- keep `repository.cleanup_worktree` local to the runtime worktree and require confirmation when it discards uncommitted changes

### Branch Command Group

Branch commands own branch lifecycle and movement.

Read commands:

- `branch.list`
- `branch.get`
- `branch.compare`

Local/runtime commands:

- `branch.checkout`
- `branch.pull`

Write commands:

- `branch.create`
- `branch.push`
- `branch.delete`

Branch command constraints:

- create branches with a safe prefix such as `assistant/<short-task-slug>` by default
- require an explicit base branch or base SHA for `branch.create`
- reject protected branches for push and delete unless a later admin policy explicitly allows them
- require a clean or explicitly acknowledged dirty worktree before `branch.push`
- require `confirm: true` and `changeReason` before `branch.push`
- require `confirm: true`, `changeReason`, and an exact branch name before `branch.delete`
- only delete assistant-created branches by default; deleting user-created branches requires a separate explicit adoption step
- audit checkout, pull, create, push, and delete separately

### Pull Request Command Group

Pull request commands own PR metadata, review activity, and merge lifecycle.

Read commands:

- `pull_request.list`
- `pull_request.search`
- `pull_request.get`
- `pull_request.list_files`
- `pull_request.list_reviews`
- `pull_request.list_comments`
- `pull_request.list_checks`

Write commands:

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

- create pull requests only from assistant-created branches or explicitly adopted branches
- create draft pull requests by default in the first implementation
- require `confirm: true` and `changeReason` for create, update, close, reopen, draft-state changes, comments, review requests, review submission, and merge
- require current head SHA for merge to avoid merging a stale branch
- reject merge when required checks are failing, missing, or stale unless a later workspace policy explicitly allows override
- support explicit merge method values only: `merge`, `squash`, or `rebase`
- return base branch, head branch, diff summary, checks summary, provider URL, and provider object id
- audit PR create, update, close, reopen, comment, review request, review submission, and merge separately
- do not expose a `pull_request.delete` command because GitHub pull requests are closed, not deleted; use `pull_request.close` plus `branch.delete` for the source branch cleanup workflow

### Issue Command Group

Issue commands are useful but lower priority than the repository, branch, and pull-request coding workflow.

Write commands:

- `issue.create`
- `issue.comment`
- `issue.update`
- `issue.close`
- `issue.reopen`
- `issue.add_labels`
- `issue.remove_labels`

Issue command constraints:

- require `confirm: true` and `changeReason` for create, update, close, reopen, and label changes
- reject archived or disabled repositories
- return the provider URL and provider object id
- audit actor, workspace, repository, command, arguments summary, and provider response metadata

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

### Phase 2: Read Command Surface

- Add the Phase 1 read commands.
- Add command schema tests and execution tests with mocked GitHub API responses.
- Add rate-limit and permission-error normalization.
- Add runtime smoke tests through `find_integration_commands` and `execute_integration_command`.
- Ship as read-only first.

### Phase 3: Repository And Branch Workflow

- Add a tenant runtime repository root with clear ownership and cleanup policy.
- Add repository checkout/fetch/pull/status/diff/commit helpers that use short-lived installation tokens without leaking them to commands, remotes, logs, or transcripts.
- Add branch list/get/compare/create/checkout/pull/push/delete helpers with allowlist, protected-branch, and branch-adoption enforcement.
- Add runtime smoke tests that clone a selected test repo, edit a file, run a harmless command, create a branch, commit, and push an assistant-created branch.
- Canary against one selected test repo before enabling this for normal workspaces.

### Phase 4: Pull Request Workflow

- Add pull request list/search/get/files/reviews/comments/checks reads.
- Add pull request create/update/close/reopen/draft-state/comment/update-comment/delete-comment/review-request/submit-review commands.
- Add guarded pull request merge with exact head SHA, required-check handling, merge method selection, and explicit confirmation.
- Add capability defaults and workspace toggles for PR write and merge groups.
- Add audit assertions for every PR write command.
- Add runtime smoke tests that create a draft PR from an assistant-created branch, update it, mark it ready, close/reopen it, and merge only in a disposable test repo.

### Phase 5: Issue Workflow

- Add issue create/comment/update/close/reopen/label commands one group at a time.
- Require `confirm` and `changeReason`.
- Add capability defaults and workspace toggles for issue write groups.
- Add audit assertions for writes.
- Canary against one selected test repo.

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
- Runtime command discovery lists GitHub read commands only when the integration is connected.
- A read command can fetch repository, issue, PR, checks, workflow run, and file metadata for an enabled repository.
- Commands reject repositories outside the selected workspace allowlist.
- No GitHub secrets or installation tokens appear in tenant runtime env, tenant runtime files, logs, or session transcripts.
- Otto can check out an enabled repository into a dedicated runtime repo root, make code edits through normal runtime tools, commit changes, push an assistant-created branch without exposing credentials, and create a draft pull request.
- Repository, branch, and pull-request command groups cover the normal lifecycle: checkout, fetch, pull, status, diff, commit, create branch, checkout branch, push branch, delete branch, create PR, update PR, close/reopen PR, mark draft/ready, comment, request review, and merge.
- Permission, suspension, and disconnected-install failures return repairable integration errors.
- Repository commit, branch push/delete, pull-request creation/update/close/reopen/merge, and issue write commands require explicit confirmation and a change reason.
- Webhook support verifies signatures and dedupes deliveries before processing events.
- Relevant unit/integration tests pass for auth binding, install callback verification, repository allowlists, command execution, checkout/pull/push token safety, PR creation/update/close/merge, branch deletion safety, and webhook signature verification.

## Open Questions

- Should the first shipped slice be read-only, or should `issue.create` and `issue.comment` ship with the initial read surface?
- Should repository selection mirror GitHub's installation selection only, or should Otto maintain an additional workspace-level repository allowlist?
- Should code worktrees live under a user-visible workspace folder or under an operator/runtime-only repository root with explicit UI links back to GitHub?
- Should the first pull-request workflow create draft PRs by default?
- Should branch push require a fresh user confirmation every time, or can a session-scoped approval cover repeated pushes to the same assistant-created branch?
- Should pull-request merge be disabled by default until a workspace explicitly enables the merge capability?
- Should branch delete be allowed only for assistant-created branches, or should explicit branch adoption be enough for user-created branches?
- Is GitHub App user OAuth required in Phase 1 to verify the setup callback robustly, or can installation verification be safely completed through app APIs plus signed workspace state?
- Should webhook event storage keep only normalized metadata, or should selected raw payloads be retained for debugging with a short TTL?
- Which GitHub rate-limit and secondary-rate-limit backoff policy should the integration framework standardize for provider commands?
- Should GitHub Enterprise Server support be planned before or after webhook support?

## Status Checklist

- [x] Integration model selected: GitHub App installation.
- [x] Risk and phase plan documented.
- [x] Runtime command catalog registered.
- [x] GitHub App installation-token helper added.
- [ ] GitHub App operator configuration created.
- [x] Framework auth binding added.
- [x] Database migration added.
- [ ] Install lifecycle implemented.
- [ ] Repository inventory UI implemented.
- [ ] Read command surface implemented.
- [ ] Repository command group implemented.
- [ ] Branch command group implemented.
- [ ] Pull-request command group implemented.
- [ ] Runtime repository checkout implemented.
- [ ] Runtime repository commit implemented.
- [ ] Branch push and delete implemented.
- [ ] Pull-request create/update/close/reopen implemented.
- [ ] Pull-request merge implemented.
- [ ] Safe write command surface implemented.
- [ ] Webhook ingress implemented.
- [ ] Production canary completed.

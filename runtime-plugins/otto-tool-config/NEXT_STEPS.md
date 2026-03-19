# Otto Tool Config Next Steps

This plugin now supports two layers:

- generic tool-surface operations for low-risk tools
- custom semantic Slack policy operations for a high-risk tool

That split is intentional, but the control-plane framework is not fully generic yet.

## Current shape

The generic framework already supports per-tool:

- schema parsing
- defaults
- semantic validation
- field metadata
- UI hints
- agent operation metadata

Slack currently goes further and adds:

- derived reachability effects
- semantic policy actions instead of raw patching
- stricter runtime-authored safety rules
- dashboard destructive-change confirmation

## Where to continue

The next refactor should move more behavior out of control-plane Slack special cases
and into the tool definition contract itself.

Add generic hooks such as:

- `deriveEffects(config, context)`
- `validateProjectedRuntimeConfig(config, context)`
- `compileToDesiredState(config, context)`
- `parseSemanticAction(value)`
- `applySemanticAction(currentConfig, action, context)`

Then teach the generic tool-config control-plane flow to call those hooks instead of
hardcoding Slack-specific branches.

## Target architecture

The control plane should own:

- auth
- persistence
- audit history
- optimistic concurrency
- install / enable / disable / reapply lifecycle
- desired-state versioning
- apply orchestration

Each tool should own:

- config shape
- normalization
- semantic validation
- derived effects
- runtime projection validation
- desired-state projection
- optional semantic actions
- optional custom UI

## Practical implication

Most tools should keep using:

- `list_configurable_tools`
- `get_configurable_tool`
- `validate_tool_change`
- `apply_tool_change`
- `set_tool_install_state`
- `reapply_tool`

Only tools with domain-specific or destructive semantics should add custom
operations like Slack did.

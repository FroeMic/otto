TOOLS.md - Local Notes

Skills define how tools work. This file is for your specifics - the stuff that's unique to your setup.

## What Goes Here

Things like:

- SSH hosts and aliases
- Service names and nicknames
- Environment-specific shortcuts
- Anything unique to this workspace setup

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

## Managed Instruction Files

- Use `list_managed_files`, `read_managed_file`, and `patch_managed_file` for `AGENTS.md`, `HEARTBEAT.md`, `IDENTITY.md`, `MEMORY.md`, `SOUL.md`, `USER.md`, and `TOOLS.md`.
- Use `list_skill_library`, `install_skill_from_library`, and `remove_installed_skill` for the library and installed-skill lifecycle under `workspace/skills/`.
- Use `list_managed_skills`, `get_managed_skill`, `list_managed_skill_package_files`, `get_managed_skill_package_file`, `create_managed_skill`, `update_managed_skill`, `delete_managed_skill`, and `reset_managed_skill_package` for lower-level managed skill package work.
- Use normal file and exec tools for local edits inside skill directories.
- Do not use managed-file tools for secrets, gateway auth, sandbox settings, or operator-only policy.

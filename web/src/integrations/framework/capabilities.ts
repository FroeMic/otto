import type {
  IntegrationCapabilityPolicy,
  IntegrationCommandEffect,
  IntegrationRuntimeCommandDefinition,
  RuntimeCapabilityState,
  RuntimeIntegrationStatus,
} from "./types";

const READ_COMMAND_VERBS = new Set(["get", "list", "list_for_url", "search"]);

const WRITE_COMMAND_VERBS = new Set([
  "add",
  "archive",
  "batch_update",
  "cancel",
  "create",
  "create_from_uploaded_file",
  "create_update",
  "delete",
  "insert_inline_image",
  "invite",
  "members_add",
  "members_remove",
  "members_update",
  "remove",
  "remove_label",
  "request_upload_url",
  "resend",
  "restore",
  "retire",
  "unarchive",
  "update",
  "upload_file",
  "upload_inline_image",
]);

function getCommandVerb(command: IntegrationRuntimeCommandDefinition) {
  const pathVerb = command.commandPath.at(-1)?.trim().toLowerCase();

  if (pathVerb) {
    return pathVerb;
  }

  return command.commandKey.split(".").at(-1)?.trim().toLowerCase() ?? "";
}

export function getCommandEffect(
  command: IntegrationRuntimeCommandDefinition,
): IntegrationCommandEffect {
  if (command.effect) {
    return command.effect;
  }

  const verb = getCommandVerb(command);

  if (READ_COMMAND_VERBS.has(verb)) {
    return "read";
  }

  if (WRITE_COMMAND_VERBS.has(verb)) {
    return "write";
  }

  return "write";
}

export function getCommandPolicy(input: {
  policy: IntegrationCapabilityPolicy | null;
}) {
  return input.policy ?? null;
}

export function isCommandUserControllable(
  command: IntegrationRuntimeCommandDefinition,
) {
  if (typeof command.userControllable === "boolean") {
    return command.userControllable;
  }

  if (command.agentAvailability?.available === false) {
    return false;
  }

  return true;
}

export function resolveCommandCapabilityState(input: {
  command: IntegrationRuntimeCommandDefinition;
  policy: IntegrationCapabilityPolicy | null;
  status: RuntimeIntegrationStatus;
}): RuntimeCapabilityState {
  if (input.status.needsAttention || !input.status.connected) {
    return {
      reason: "Integration disconnected.",
      status: "needs_attention",
    };
  }

  if (input.command.agentAvailability?.available === false) {
    return {
      reason: input.command.agentAvailability.reason,
      status: "disabled",
    };
  }

  if (input.policy?.policy === "block") {
    return {
      reason: "Disabled by workspace policy.",
      status: "disabled",
    };
  }

  return {
    status: "enabled",
  };
}

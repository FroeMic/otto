import type { WhatsAppRuntimeConfig } from "@/lib/whatsapp-config";

export type WhatsAppPolicyDerivedEffects = {
  dmEnabled: boolean;
  effectiveAllowedNumbers: string[];
  effectiveGroupAllowedNumbers: string[];
  effectiveGroupIds: string[];
  groupRepliesEnabled: boolean;
  warnings: string[];
  wouldDisableDMs: boolean;
  wouldDisableGroupReplies: boolean;
  wouldFullyLockOutWhatsApp: boolean;
};

function getDmEnabled(config: WhatsAppRuntimeConfig) {
  if (config.dmPolicy === "disabled") {
    return false;
  }

  if (config.dmPolicy === "allowlist") {
    return config.allowedNumbers.length > 0;
  }

  return true;
}

function getEffectiveGroupAllowedNumbers(config: WhatsAppRuntimeConfig) {
  return config.groupAllowedNumbers.length > 0
    ? config.groupAllowedNumbers
    : config.allowedNumbers;
}

function getGroupRepliesEnabled(config: WhatsAppRuntimeConfig) {
  return (
    config.groupPolicy === "allowlist" &&
    config.allowedGroupIds.length > 0 &&
    getEffectiveGroupAllowedNumbers(config).length > 0
  );
}

export function deriveWhatsAppPolicyEffects(params: {
  config: WhatsAppRuntimeConfig;
  currentConfig?: WhatsAppRuntimeConfig;
}): WhatsAppPolicyDerivedEffects {
  const { config, currentConfig } = params;
  const dmEnabled = getDmEnabled(config);
  const effectiveGroupAllowedNumbers = getEffectiveGroupAllowedNumbers(config);
  const groupRepliesEnabled = getGroupRepliesEnabled(config);
  const currentDmEnabled = currentConfig ? getDmEnabled(currentConfig) : false;
  const currentGroupRepliesEnabled = currentConfig
    ? getGroupRepliesEnabled(currentConfig)
    : false;
  const wouldDisableDMs = currentDmEnabled && !dmEnabled;
  const wouldDisableGroupReplies =
    currentGroupRepliesEnabled && !groupRepliesEnabled;
  const wouldFullyLockOutWhatsApp = !dmEnabled && !groupRepliesEnabled;
  const warnings: string[] = [];

  if (wouldDisableDMs) {
    warnings.push(
      "This change disables all direct messages to Otto on WhatsApp.",
    );
  }

  if (wouldDisableGroupReplies) {
    warnings.push(
      "This change disables all allowed WhatsApp group replies for Otto.",
    );
  }

  if (wouldFullyLockOutWhatsApp) {
    warnings.push(
      "This configuration fully locks Otto out of WhatsApp until numbers or groups are re-enabled.",
    );
  }

  return {
    dmEnabled,
    effectiveAllowedNumbers: config.allowedNumbers,
    effectiveGroupAllowedNumbers,
    effectiveGroupIds: config.allowedGroupIds,
    groupRepliesEnabled,
    warnings,
    wouldDisableDMs,
    wouldDisableGroupReplies,
    wouldFullyLockOutWhatsApp,
  };
}

export function isWhatsAppPolicyDestructive(
  effects: Pick<
    WhatsAppPolicyDerivedEffects,
    "wouldDisableDMs" | "wouldDisableGroupReplies" | "wouldFullyLockOutWhatsApp"
  >,
) {
  return (
    effects.wouldDisableDMs ||
    effects.wouldDisableGroupReplies ||
    effects.wouldFullyLockOutWhatsApp
  );
}

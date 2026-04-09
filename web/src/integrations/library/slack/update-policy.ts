export function getSlackDestructiveChangeError(input: {
  allowDestructiveChanges?: boolean;
  createdByType: "runtime" | "system" | "user";
  isDestructive: boolean;
}) {
  if (!input.isDestructive) {
    return null;
  }

  if (input.createdByType === "user" && !input.allowDestructiveChanges) {
    return "This Slack settings change would disable direct messages or channel replies. Confirm the destructive change in the dashboard before saving it.";
  }

  return null;
}

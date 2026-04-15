import type {
  WorkspaceInstalledSkillListEntry,
  WorkspaceSkillDetail,
} from "./types"

export const skillStatusBadgeVariant: Record<
  WorkspaceInstalledSkillListEntry["status"] | WorkspaceSkillDetail["status"],
  "default" | "destructive" | "outline" | "secondary"
> = {
  disabled: "secondary",
  invalid: "destructive",
  missing_prerequisite: "outline",
  projection_failed: "destructive",
  ready: "default",
}

export function formatSkillStatusLabel(
  status: WorkspaceInstalledSkillListEntry["status"] | WorkspaceSkillDetail["status"],
) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function formatSkillOriginLabel(
  origin: WorkspaceInstalledSkillListEntry["origin"] | WorkspaceSkillDetail["origin"],
) {
  return origin === "custom" ? "Custom" : "From library"
}

export function getSkillStatusDescription(status: WorkspaceSkillDetail["status"]) {
  switch (status) {
    case "ready":
      return "This skill is available to the agent in this workspace."
    case "missing_prerequisite":
      return "This skill depends on an integration or related skill that is not available yet."
    case "projection_failed":
      return "The latest update did not reach the runtime cleanly. The skill is still stored here, but the runtime needs attention."
    case "invalid":
      return "This skill package is invalid and needs to be fixed before the agent should rely on it."
    case "disabled":
      return "This skill is installed in the workspace, but it is currently disabled."
  }
}

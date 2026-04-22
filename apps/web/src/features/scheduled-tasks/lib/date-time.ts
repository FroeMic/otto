import type { WorkspaceDateTimePreferences } from "@/features/workspace/date-time"

function resolveHour12(timeFormatPreference: string) {
  if (timeFormatPreference === "12") {
    return true
  }

  if (timeFormatPreference === "24") {
    return false
  }

  return undefined
}

export function formatShortDateTime(
  value: Date | null,
  preferences: WorkspaceDateTimePreferences,
) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat(preferences.locale, {
    day: "numeric",
    hour: "numeric",
    hour12: resolveHour12(preferences.timeFormatPreference),
    minute: "2-digit",
    month: "short",
    timeZone: preferences.timeZone,
  }).format(value)
}

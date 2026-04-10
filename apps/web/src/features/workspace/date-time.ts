export interface WorkspaceDateTimePreferences {
  locale: string
  timeFormatPreference: string
  timeZone: string
}

export function formatShortDate(
  value: Date,
  input: WorkspaceDateTimePreferences,
) {
  return new Intl.DateTimeFormat(input.locale, {
    dateStyle: "medium",
    hour: "numeric",
    minute: "2-digit",
    timeZone: input.timeZone,
    ...(input.timeFormatPreference === "12h"
      ? { hour12: true }
      : input.timeFormatPreference === "24h"
        ? { hour12: false }
        : {}),
  }).format(value)
}

import {
  normalizeLocale,
  normalizeTimeFormatPreference,
  normalizeTimeZone,
} from "@otto/feature-workspace-core"

export interface PlatformDateTimePreferences {
  locale: string
  timeFormatPreference: string
  timeZone: string
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(input: {
  locale: string
  options: Intl.DateTimeFormatOptions
  timeZone: string
}) {
  const cacheKey = JSON.stringify(input)
  const cached = formatterCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const formatter = new Intl.DateTimeFormat(input.locale, {
    ...input.options,
    timeZone: input.timeZone,
  })
  formatterCache.set(cacheKey, formatter)

  return formatter
}

function getTimeOptions(
  options: Intl.DateTimeFormatOptions,
  timeFormatPreference: string,
) {
  return {
    ...options,
    ...(timeFormatPreference === "12"
      ? { hour12: true }
      : timeFormatPreference === "24"
        ? { hour12: false }
        : {}),
  }
}

export function resolvePlatformDateTimePreferences(input: {
  locale?: string | null
  timeFormatPreference?: string | null
  timeZone?: string | null
}): PlatformDateTimePreferences {
  return {
    locale: normalizeLocale(input.locale),
    timeFormatPreference: normalizeTimeFormatPreference(
      input.timeFormatPreference,
    ),
    timeZone: normalizeTimeZone(input.timeZone),
  }
}

export function toDate(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatPreciseDateTime(
  value: string | Date | null | undefined,
  input: PlatformDateTimePreferences,
) {
  const date = toDate(value)

  if (!date) {
    return "Not available"
  }

  return getFormatter({
    locale: input.locale,
    options: getTimeOptions(
      {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        second: "2-digit",
        timeZoneName: "short",
        year: "numeric",
      },
      input.timeFormatPreference,
    ),
    timeZone: input.timeZone,
  }).format(date)
}

export function formatSearchDateTime(
  value: string | Date | null | undefined,
  input: PlatformDateTimePreferences,
) {
  const date = toDate(value)

  if (!date) {
    return ""
  }

  return getFormatter({
    locale: input.locale,
    options: getTimeOptions(
      {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
      input.timeFormatPreference,
    ),
    timeZone: input.timeZone,
  }).format(date)
}

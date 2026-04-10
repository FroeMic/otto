const DEFAULT_LOCALE = "en-US"
const DEFAULT_TIME_FORMAT_PREFERENCE = "auto"
const DEFAULT_TIME_ZONE = "UTC"

export function normalizeLocale(locale?: string | null) {
  if (!locale) {
    return DEFAULT_LOCALE
  }

  try {
    const [canonicalLocale] = Intl.getCanonicalLocales(locale)

    return canonicalLocale ?? DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function isSupportedLocale(locale: string) {
  return normalizeLocale(locale) === locale
}

export function normalizeTimeZone(timeZone?: string | null) {
  if (!timeZone) {
    return DEFAULT_TIME_ZONE
  }

  try {
    new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      timeZone,
    }).format(new Date())

    return timeZone
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

export function isSupportedTimeZone(timeZone: string) {
  return normalizeTimeZone(timeZone) === timeZone
}

export function normalizeTimeFormatPreference(value?: string | null) {
  if (value === "12" || value === "24" || value === "auto") {
    return value
  }

  return DEFAULT_TIME_FORMAT_PREFERENCE
}

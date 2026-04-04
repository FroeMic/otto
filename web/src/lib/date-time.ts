const DEFAULT_LOCALE = "en-US";
export const DEFAULT_WORKSPACE_TIME_ZONE = "UTC";
export const DEFAULT_TIME_FORMAT_PREFERENCE = "auto";

export type WorkspaceTimeFormatPreference = "auto" | "12" | "24";

export type WorkspaceDateTimePreferences = {
  locale: string;
  timeFormatPreference: WorkspaceTimeFormatPreference;
  timeZone: string;
};

export type TimeZoneOption = {
  label: string;
  value: string;
};

export type TimeZoneOptionGroup = {
  items: TimeZoneOption[];
  value: string;
};

type DateFormatterInput = {
  locale?: string;
  options: Intl.DateTimeFormatOptions;
  timeZone?: string | null;
};

type FormatDateInput = {
  locale?: string;
  timeZone?: string | null;
  timeFormatPreference?: WorkspaceTimeFormatPreference | string | null;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(input: DateFormatterInput) {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const timeZone = normalizeTimeZone(input.timeZone);
  const cacheKey = JSON.stringify({
    locale,
    options: input.options,
    timeZone,
  });

  const cached = formatterCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    ...input.options,
    timeZone,
  });

  formatterCache.set(cacheKey, formatter);

  return formatter;
}

export function normalizeTimeZone(timeZone?: string | null) {
  if (!timeZone) {
    return DEFAULT_WORKSPACE_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      timeZone,
    }).format(new Date());

    return timeZone;
  } catch {
    return DEFAULT_WORKSPACE_TIME_ZONE;
  }
}

export function normalizeLocale(locale?: string | null) {
  if (!locale) {
    return DEFAULT_LOCALE;
  }

  try {
    const [canonicalLocale] = Intl.getCanonicalLocales(locale);

    return canonicalLocale ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function isSupportedLocale(locale: string) {
  return normalizeLocale(locale) === locale;
}

export function normalizeTimeFormatPreference(
  timeFormatPreference?: WorkspaceTimeFormatPreference | string | null,
): WorkspaceTimeFormatPreference {
  if (
    timeFormatPreference === "12" ||
    timeFormatPreference === "24" ||
    timeFormatPreference === "auto"
  ) {
    return timeFormatPreference;
  }

  return DEFAULT_TIME_FORMAT_PREFERENCE;
}

export function resolveDateTimePreferences(
  input: FormatDateInput = {},
): WorkspaceDateTimePreferences {
  return {
    locale: normalizeLocale(input.locale),
    timeFormatPreference: normalizeTimeFormatPreference(
      input.timeFormatPreference,
    ),
    timeZone: normalizeTimeZone(input.timeZone),
  };
}

export function isSupportedTimeZone(timeZone: string) {
  return normalizeTimeZone(timeZone) === timeZone;
}

function getTimeOptions(
  options: Intl.DateTimeFormatOptions,
  timeFormatPreference: WorkspaceTimeFormatPreference,
) {
  return {
    ...options,
    ...(timeFormatPreference === "12"
      ? { hour12: true }
      : timeFormatPreference === "24"
        ? { hour12: false }
        : {}),
  };
}

export function formatShortDateTime(
  value: Date | number | null,
  input: FormatDateInput = {},
) {
  if (value === null) {
    return "-";
  }

  const preferences = resolveDateTimePreferences(input);

  return getFormatter({
    locale: preferences.locale,
    options: getTimeOptions(
      {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
      },
      preferences.timeFormatPreference,
    ),
    timeZone: preferences.timeZone,
  }).format(value);
}

export function formatShortDate(
  value: Date | number | null,
  input: FormatDateInput = {},
) {
  if (value === null) {
    return "-";
  }

  const preferences = resolveDateTimePreferences(input);

  return getFormatter({
    locale: preferences.locale,
    options: {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
    timeZone: preferences.timeZone,
  }).format(value);
}

export function formatTimeOfDay(
  value: Date | number | null,
  input: FormatDateInput & {
    includeSeconds?: boolean;
  } = {},
) {
  if (value === null) {
    return "";
  }

  const preferences = resolveDateTimePreferences(input);

  return getFormatter({
    locale: preferences.locale,
    options: getTimeOptions(
      {
        hour: "2-digit",
        minute: "2-digit",
        ...(input.includeSeconds ? { second: "2-digit" } : {}),
      },
      preferences.timeFormatPreference,
    ),
    timeZone: preferences.timeZone,
  }).format(value);
}

export function formatPreciseDateTime(
  value: Date | number | null,
  input: FormatDateInput = {},
) {
  if (value === null) {
    return "Not available";
  }

  const preferences = resolveDateTimePreferences(input);

  return getFormatter({
    locale: preferences.locale,
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
      preferences.timeFormatPreference,
    ),
    timeZone: preferences.timeZone,
  }).format(value);
}

export function formatSearchDateTime(
  value: Date | number | null,
  input: FormatDateInput = {},
) {
  if (value === null) {
    return "";
  }

  const preferences = resolveDateTimePreferences(input);

  return getFormatter({
    locale: preferences.locale,
    options: getTimeOptions(
      {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
      preferences.timeFormatPreference,
    ),
    timeZone: preferences.timeZone,
  }).format(value);
}

function getTimeZoneOffsetLabel(timeZone: string) {
  try {
    const parts = getFormatter({
      options: {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "shortOffset",
      },
      timeZone,
    }).formatToParts(new Date());

    return parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  } catch {
    return "GMT+0";
  }
}

export function getSupportedTimeZones() {
  const supportedValuesOf = Intl.supportedValuesOf as
    | ((key: "timeZone") => string[])
    | undefined;

  const values = supportedValuesOf
    ? supportedValuesOf("timeZone")
    : [
        "UTC",
        "America/Los_Angeles",
        "America/Denver",
        "America/Chicago",
        "America/New_York",
        "Europe/London",
        "Europe/Berlin",
        "Asia/Singapore",
        "Asia/Tokyo",
        "Australia/Sydney",
      ];

  return values.includes(DEFAULT_WORKSPACE_TIME_ZONE)
    ? values
    : [DEFAULT_WORKSPACE_TIME_ZONE, ...values];
}

const COMMON_LOCALE_OPTIONS = [
  { label: "English (US)", value: "en-US" },
  { label: "English (UK)", value: "en-GB" },
  { label: "German", value: "de-DE" },
  { label: "French", value: "fr-FR" },
  { label: "Spanish", value: "es-ES" },
  { label: "Italian", value: "it-IT" },
  { label: "Dutch", value: "nl-NL" },
  { label: "Portuguese (Brazil)", value: "pt-BR" },
  { label: "Japanese", value: "ja-JP" },
  { label: "Korean", value: "ko-KR" },
  { label: "Chinese (Simplified)", value: "zh-CN" },
] as const;

export function getLocaleOptions() {
  return COMMON_LOCALE_OPTIONS;
}

export function getTimeFormatPreferenceOptions() {
  return [
    {
      label: "Automatic",
      value: "auto" as const,
    },
    {
      label: "12-hour",
      value: "12" as const,
    },
    {
      label: "24-hour",
      value: "24" as const,
    },
  ];
}

export function getTimeZoneOptions() {
  return getSupportedTimeZones().map((timeZone) => ({
    label: `${timeZone} (${getTimeZoneOffsetLabel(timeZone)})`,
    value: timeZone,
  }));
}

function getTimeZoneGroupLabel(timeZone: string) {
  if (timeZone === "UTC") {
    return "Universal";
  }

  if (timeZone.startsWith("America/")) {
    return "Americas";
  }

  if (timeZone.startsWith("Europe/") || timeZone.startsWith("Africa/")) {
    return "Europe / Africa";
  }

  if (
    timeZone.startsWith("Asia/") ||
    timeZone.startsWith("Indian/") ||
    timeZone.startsWith("Pacific/") ||
    timeZone.startsWith("Australia/")
  ) {
    return "Asia / Pacific";
  }

  return "Other";
}

function getTimeZoneLocationLabel(timeZone: string) {
  if (timeZone === "UTC") {
    return "UTC";
  }

  const path = timeZone.split("/").slice(1).join(" / ");

  return path.replaceAll("_", " ");
}

export function getGroupedTimeZoneOptions() {
  const groups = new Map<string, TimeZoneOption[]>();

  for (const timeZone of getSupportedTimeZones()) {
    const groupLabel = getTimeZoneGroupLabel(timeZone);
    const option = {
      label: `(${getTimeZoneOffsetLabel(timeZone)}) ${getTimeZoneLocationLabel(timeZone)}`,
      value: timeZone,
    } satisfies TimeZoneOption;

    const existing = groups.get(groupLabel) ?? [];
    existing.push(option);
    groups.set(groupLabel, existing);
  }

  return Array.from(groups.entries())
    .map(([value, items]) => ({
      items: items.toSorted((left, right) =>
        left.label.localeCompare(right.label),
      ),
      value,
    }))
    .toSorted((left, right) => {
      if (left.value === "Universal") {
        return -1;
      }

      if (right.value === "Universal") {
        return 1;
      }

      return left.value.localeCompare(right.value);
    }) satisfies TimeZoneOptionGroup[];
}

import {
  normalizeLocale,
  normalizeTimeFormatPreference,
  normalizeTimeZone,
} from "@otto/feature-workspace-core"

export type WorkspaceTimeFormatPreference = "auto" | "12" | "24"

export interface WorkspaceDateTimePreferences {
  locale: string
  timeFormatPreference: string
  timeZone: string
}

export interface WorkspaceLocaleOption {
  label: string
  value: string
}

export interface WorkspaceTimeZoneOption {
  label: string
  value: string
}

export interface WorkspaceTimeZoneOptionGroup {
  items: WorkspaceTimeZoneOption[]
  value: string
}

const defaultLocale = "en-US"
const defaultTimeZone = "UTC"

const localeOptions = [
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
] satisfies WorkspaceLocaleOption[]

const curatedTimeZoneGroups = [
  {
    items: [{ city: "UTC", value: "UTC" }],
    value: "Universal",
  },
  {
    items: [
      { city: "New York", value: "America/New_York" },
      { city: "Los Angeles", value: "America/Los_Angeles" },
      { city: "Chicago", value: "America/Chicago" },
      { city: "Toronto", value: "America/Toronto" },
      { city: "Vancouver", value: "America/Vancouver" },
      { city: "Sao Paulo", value: "America/Sao_Paulo" },
    ],
    value: "Americas",
  },
  {
    items: [
      { city: "London", value: "Europe/London" },
      { city: "Paris", value: "Europe/Paris" },
      { city: "Berlin", value: "Europe/Berlin" },
      { city: "Rome", value: "Europe/Rome" },
      { city: "Madrid", value: "Europe/Madrid" },
      { city: "Amsterdam", value: "Europe/Amsterdam" },
    ],
    value: "Europe",
  },
  {
    items: [
      { city: "Tokyo", value: "Asia/Tokyo" },
      { city: "Shanghai", value: "Asia/Shanghai" },
      { city: "Singapore", value: "Asia/Singapore" },
      { city: "Dubai", value: "Asia/Dubai" },
      { city: "Sydney", value: "Australia/Sydney" },
      { city: "Seoul", value: "Asia/Seoul" },
    ],
    value: "Asia / Pacific",
  },
] satisfies Array<{
  items: Array<{
    city: string
    value: string
  }>
  value: string
}>

function getTimeZoneOffsetLabel(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat(defaultLocale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date())

    return parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0"
  } catch {
    return "GMT+0"
  }
}

function createTimeZoneOption(input: {
  city: string
  value: string
}): WorkspaceTimeZoneOption {
  return {
    label: `(${getTimeZoneOffsetLabel(input.value)}) ${input.city}`,
    value: input.value,
  }
}

export function resolveWorkspaceDateTimePreferences(input: {
  locale?: string | null
  timeFormatPreference?: string | null
  timeZone?: string | null
}): WorkspaceDateTimePreferences {
  return {
    locale: normalizeLocale(input.locale),
    timeFormatPreference: normalizeTimeFormatPreference(
      input.timeFormatPreference,
    ) as WorkspaceTimeFormatPreference,
    timeZone: normalizeTimeZone(input.timeZone),
  }
}

export function getLocaleOptions() {
  return localeOptions
}

export function getTimeFormatPreferenceOptions(): Array<{
  label: string
  value: WorkspaceTimeFormatPreference
}> {
  return [
    {
      label: "Automatic",
      value: "auto",
    },
    {
      label: "12-hour",
      value: "12",
    },
    {
      label: "24-hour",
      value: "24",
    },
  ]
}

export function getGroupedTimeZoneOptions(
  currentTimeZone?: string | null,
): WorkspaceTimeZoneOptionGroup[] {
  const groups = curatedTimeZoneGroups.map((group) => ({
    items: group.items.map(createTimeZoneOption),
    value: group.value,
  }))
  const normalizedCurrentTimeZone = normalizeTimeZone(currentTimeZone)
  const isCurrentIncluded = groups.some((group) => {
    return group.items.some((item) => item.value === normalizedCurrentTimeZone)
  })

  if (
    normalizedCurrentTimeZone !== defaultTimeZone &&
    !isCurrentIncluded
  ) {
    groups.splice(1, 0, {
      items: [
        {
          label: `(${getTimeZoneOffsetLabel(normalizedCurrentTimeZone)}) ${normalizedCurrentTimeZone}`,
          value: normalizedCurrentTimeZone,
        },
      ],
      value: "Current",
    })
  }

  return groups
}

export function formatShortDate(
  value: Date,
  input: WorkspaceDateTimePreferences,
) {
  return new Intl.DateTimeFormat(input.locale, {
    day: "numeric",
    month: "short",
    timeZone: input.timeZone,
    year: "numeric",
  }).format(value)
}

import type { WorkspaceDateTimePreferences } from "@/features/workspace/date-time"

import { formatShortDateTime } from "./date-time"

const DEFAULT_WORKSPACE_TIME_ZONE = "UTC"

interface ScheduleInput {
  dateTimePreferences: WorkspaceDateTimePreferences
  scheduleExpression: string
  scheduleJson: Record<string, unknown> | null
  timezone: string | null
}

type ParsedField =
  | { kind: "any" }
  | { kind: "every"; step: number }
  | { kind: "exact"; value: number }
  | { kind: "list"; values: number[] }

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

export function describeScheduledTaskSchedule(input: ScheduleInput) {
  const schedule = input.scheduleJson
  const kind = typeof schedule?.kind === "string" ? schedule.kind : null

  if (kind === "every") {
    const everyMs =
      typeof schedule?.everyMs === "number" ? schedule.everyMs : null

    return everyMs ? `Every ${formatDurationMs(everyMs)}` : "Recurring"
  }

  if (kind === "at") {
    const at = typeof schedule?.at === "string" ? schedule.at : null

    return formatAtSchedule(at, input.dateTimePreferences)
  }

  return describeCronExpression(
    input.scheduleExpression,
    input.timezone,
    input.dateTimePreferences,
  )
}

export function describeCronExpression(
  expression: string,
  timezone?: string | null,
  dateTimePreferences?: WorkspaceDateTimePreferences,
) {
  const parts = expression.trim().split(/\s+/)

  if (parts.length !== 5) {
    return expression
  }

  const [minuteExpr, hourExpr, dayOfMonthExpr, monthExpr, dayOfWeekExpr] =
    parts
  const minute = parseField(minuteExpr, { max: 59, min: 0, names: null })
  const hour = parseField(hourExpr, { max: 23, min: 0, names: null })
  const dayOfMonth = parseField(dayOfMonthExpr, {
    max: 31,
    min: 1,
    names: null,
  })
  const month = parseField(monthExpr, {
    max: 12,
    min: 1,
    names: MONTH_NAMES,
  })
  const dayOfWeek = parseField(dayOfWeekExpr, {
    max: 7,
    min: 0,
    names: DAY_NAMES,
  })

  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return expression
  }

  const taskTimeZone = timezone ?? DEFAULT_WORKSPACE_TIME_ZONE
  const workspaceTimeZone =
    dateTimePreferences?.timeZone ?? DEFAULT_WORKSPACE_TIME_ZONE
  const formatTime = (hourValue: number, minuteValue: number) =>
    formatCronTime(hourValue, minuteValue, taskTimeZone, dateTimePreferences)

  const dailyPattern =
    isAny(dayOfMonth) && isAny(month) && isAny(dayOfWeek)
      ? describeDailyPattern(
          minute,
          hour,
          formatTime,
          taskTimeZone,
          workspaceTimeZone,
        )
      : null

  if (dailyPattern) {
    return dailyPattern
  }

  if (
    isExact(minute) &&
    isExact(hour) &&
    isAny(dayOfMonth) &&
    isAny(month) &&
    isNamedOrNumericList(dayOfWeek)
  ) {
    return `Every ${formatWeekdays(dayOfWeek)} at ${formatTime(
      hour.value,
      minute.value,
    )}`
  }

  if (
    isExact(minute) &&
    isExact(hour) &&
    isNamedOrNumericList(dayOfMonth) &&
    isAny(month) &&
    isAny(dayOfWeek)
  ) {
    return `Every month on ${formatMonthDays(dayOfMonth)} at ${formatTime(
      hour.value,
      minute.value,
    )}`
  }

  if (
    isExact(minute) &&
    isExact(hour) &&
    isNamedOrNumericList(dayOfMonth) &&
    isNamedOrNumericList(month) &&
    isAny(dayOfWeek)
  ) {
    return `Every ${formatMonths(month)} ${formatMonthDays(dayOfMonth)} at ${formatTime(
      hour.value,
      minute.value,
    )}`
  }

  return expression
}

function describeDailyPattern(
  minute: ParsedField,
  hour: ParsedField,
  formatTime: (hourValue: number, minuteValue: number) => string,
  taskTimeZone: string,
  workspaceTimeZone: string,
) {
  if (isEvery(minute) && minute.step === 1 && isAny(hour)) {
    return "Every minute"
  }

  if (isEvery(minute) && isAny(hour)) {
    return `Every ${minute.step} minutes`
  }

  if (isExact(minute) && isAny(hour)) {
    const converted = convertCronTime(
      0,
      minute.value,
      taskTimeZone,
      workspaceTimeZone,
    )

    return `Every hour at :${pad2(converted.minute)}`
  }

  if (isExact(minute) && isEvery(hour)) {
    return `Every ${hour.step} hours at :${pad2(minute.value)}`
  }

  if (isExact(minute) && isExact(hour)) {
    return `Every day at ${formatTime(hour.value, minute.value)}`
  }

  return null
}

function convertCronTime(
  hour: number,
  minute: number,
  taskTimezone: string,
  workspaceTimezone: string,
) {
  if (taskTimezone === workspaceTimezone) {
    return { hour, minute }
  }

  const now = new Date()
  const guess = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      minute,
      0,
      0,
    ),
  )
  const taskParts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    minute: "numeric",
    timeZone: taskTimezone,
  }).formatToParts(guess)
  const taskHour = Number.parseInt(
    taskParts.find((part) => part.type === "hour")?.value ?? "0",
    10,
  )
  const taskMinute = Number.parseInt(
    taskParts.find((part) => part.type === "minute")?.value ?? "0",
    10,
  )
  const adjusted = new Date(
    guess.getTime() +
      ((hour - (taskHour === 24 ? 0 : taskHour)) * 60 +
        (minute - taskMinute)) *
        60_000,
  )
  const workspaceParts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    minute: "numeric",
    timeZone: workspaceTimezone,
  }).formatToParts(adjusted)
  const workspaceHour = Number.parseInt(
    workspaceParts.find((part) => part.type === "hour")?.value ?? "0",
    10,
  )
  const workspaceMinute = Number.parseInt(
    workspaceParts.find((part) => part.type === "minute")?.value ?? "0",
    10,
  )

  return {
    hour: workspaceHour === 24 ? 0 : workspaceHour,
    minute: workspaceMinute,
  }
}

function formatCronTime(
  hour: number,
  minute: number,
  taskTimeZone: string,
  preferences?: WorkspaceDateTimePreferences,
) {
  const workspaceTimeZone =
    preferences?.timeZone ?? DEFAULT_WORKSPACE_TIME_ZONE
  const converted = convertCronTime(
    hour,
    minute,
    taskTimeZone,
    workspaceTimeZone,
  )

  if (!preferences || preferences.timeFormatPreference === "24") {
    return `${pad2(converted.hour)}:${pad2(converted.minute)}`
  }

  if (preferences.timeFormatPreference === "12") {
    return format12h(converted.hour, converted.minute)
  }

  const resolved = new Intl.DateTimeFormat(preferences.locale, {
    hour: "numeric",
  }).resolvedOptions()

  return resolved.hour12
    ? format12h(converted.hour, converted.minute)
    : `${pad2(converted.hour)}:${pad2(converted.minute)}`
}

function format12h(hour: number, minute: number) {
  const period = hour >= 12 ? "PM" : "AM"
  const nextHour = hour % 12 || 12

  return `${nextHour}:${pad2(minute)} ${period}`
}

function parseField(
  raw: string,
  options: {
    max: number
    min: number
    names: readonly string[] | null
  },
): ParsedField | null {
  if (raw === "*") {
    return { kind: "any" }
  }

  const everyMatch = /^\*\/(\d+)$/.exec(raw)

  if (everyMatch) {
    const step = Number.parseInt(everyMatch[1], 10)

    return step >= 1 ? { kind: "every", step } : null
  }

  if (raw.includes(",")) {
    const values = raw
      .split(",")
      .map((part) => parseValue(part, options))
      .filter((value): value is number => value !== null)

    if (values.length === raw.split(",").length) {
      return {
        kind: "list",
        values: Array.from(new Set(values)).sort((left, right) => left - right),
      }
    }

    return null
  }

  const value = parseValue(raw, options)

  return value === null ? null : { kind: "exact", value }
}

function parseValue(
  raw: string,
  options: {
    max: number
    min: number
    names: readonly string[] | null
  },
) {
  const trimmed = raw.trim()

  if (!/^\d+$/.test(trimmed)) {
    return options.names ? parseNamedValue(trimmed, options.names) : null
  }

  const numeric = Number.parseInt(trimmed, 10)

  if (
    Number.isInteger(numeric) &&
    numeric >= options.min &&
    numeric <= options.max
  ) {
    if (options.names === DAY_NAMES && numeric === 7) {
      return 0
    }

    return numeric
  }

  return null
}

function parseNamedValue(trimmed: string, names: readonly string[]) {
  const matchIndex = names.findIndex(
    (name) => name.toLowerCase() === trimmed.slice(0, 3).toLowerCase(),
  )

  if (matchIndex === -1) {
    return null
  }

  return names === MONTH_NAMES ? matchIndex + 1 : matchIndex
}

function formatWeekdays(
  field: Extract<ParsedField, { kind: "exact" | "list" }>,
) {
  const values = field.kind === "exact" ? [field.value] : field.values

  return values.map((value) => DAY_NAMES[value] ?? String(value)).join(", ")
}

function formatMonthDays(
  field: Extract<ParsedField, { kind: "exact" | "list" }>,
) {
  const values = field.kind === "exact" ? [field.value] : field.values

  return values.map((value) => `day ${value}`).join(", ")
}

function formatMonths(field: Extract<ParsedField, { kind: "exact" | "list" }>) {
  const values = field.kind === "exact" ? [field.value] : field.values

  return values
    .map((value) => MONTH_NAMES[value - 1] ?? String(value))
    .join(", ")
}

function formatAtSchedule(
  at: string | null,
  preferences: WorkspaceDateTimePreferences,
) {
  if (!at) {
    return "One-time"
  }

  const date = new Date(at)

  if (Number.isNaN(date.getTime())) {
    return at
  }

  return `Once at ${formatShortDateTime(date, preferences)}`
}

function formatDurationMs(ms: number) {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []

  if (days > 0) {
    parts.push(`${days} day${days === 1 ? "" : "s"}`)
  }

  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`)
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`)
  }

  return parts.join(" ")
}

function isAny(field: ParsedField) {
  return field.kind === "any"
}

function isEvery(
  field: ParsedField,
): field is Extract<ParsedField, { kind: "every" }> {
  return field.kind === "every"
}

function isExact(
  field: ParsedField,
): field is Extract<ParsedField, { kind: "exact" }> {
  return field.kind === "exact"
}

function isNamedOrNumericList(
  field: ParsedField,
): field is Extract<ParsedField, { kind: "exact" | "list" }> {
  return field.kind === "exact" || field.kind === "list"
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}


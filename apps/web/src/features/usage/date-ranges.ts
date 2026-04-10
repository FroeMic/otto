export type UsageRangePresetKey =
  | "current_cycle"
  | "previous_cycle"
  | "today"
  | "this_week"
  | "this_month"
  | "this_year"
  | "last_24h"
  | "last_7d"
  | "last_30d"
  | "last_year"
  | "custom"

export interface UsageDatePresetDefinition {
  key: Exclude<UsageRangePresetKey, "custom">
  label: string
}

export interface UsageDateRange {
  from: Date
  to: Date
}

function copyDate(date: Date) {
  return new Date(date)
}

function startOfUtcDay(date: Date) {
  const next = copyDate(date)
  next.setUTCHours(0, 0, 0, 0)
  return next
}

function endOfUtcDay(date: Date) {
  const next = startOfUtcDay(date)
  next.setUTCDate(next.getUTCDate() + 1)
  next.setUTCMilliseconds(next.getUTCMilliseconds() - 1)
  return next
}

function startOfUtcWeek(date: Date) {
  const next = startOfUtcDay(date)
  const day = next.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setUTCDate(next.getUTCDate() + diff)
  return next
}

function endOfUtcWeek(date: Date) {
  const next = startOfUtcWeek(date)
  next.setUTCDate(next.getUTCDate() + 7)
  next.setUTCMilliseconds(next.getUTCMilliseconds() - 1)
  return next
}

function startOfUtcMonth(date: Date) {
  const next = copyDate(date)
  next.setUTCDate(1)
  next.setUTCHours(0, 0, 0, 0)
  return next
}

function endOfUtcMonth(date: Date) {
  const next = startOfUtcMonth(date)
  next.setUTCMonth(next.getUTCMonth() + 1)
  next.setUTCMilliseconds(next.getUTCMilliseconds() - 1)
  return next
}

function startOfUtcYear(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0))
}

function endOfUtcYear(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 11, 31, 23, 59, 59, 999))
}

function createUsageDateRange(from: Date, to: Date): UsageDateRange {
  return {
    from,
    to,
  }
}

export function getPreviousBillingCycleRange(input: {
  currentPeriodEnd: Date | null
  currentPeriodStart: Date | null
}) {
  if (!input.currentPeriodStart || !input.currentPeriodEnd) {
    return null
  }

  const cycleDurationMs =
    input.currentPeriodEnd.getTime() - input.currentPeriodStart.getTime()

  return createUsageDateRange(
    new Date(input.currentPeriodStart.getTime() - cycleDurationMs),
    new Date(input.currentPeriodStart.getTime() - 1),
  )
}

export function getUsagePresetDefinitions(input: {
  hasBillingCycle: boolean
  hasPreviousBillingCycle: boolean
}) {
  const presets: UsageDatePresetDefinition[] = []

  if (input.hasBillingCycle) {
    presets.push({
      key: "current_cycle",
      label: "Current Billing Cycle",
    })
  }

  if (input.hasPreviousBillingCycle) {
    presets.push({
      key: "previous_cycle",
      label: "Previous Billing Cycle",
    })
  }

  presets.push(
    { key: "today", label: "Today" },
    { key: "this_week", label: "This Week" },
    { key: "this_month", label: "This Month" },
    { key: "this_year", label: "This Year" },
    { key: "last_24h", label: "Last 24 hours" },
    { key: "last_7d", label: "Last 7 days" },
    { key: "last_30d", label: "Last 30 days" },
    { key: "last_year", label: "Last year" },
  )

  return presets
}

export function getUsagePresetRanges(input: {
  currentCycleEnd: Date | null
  currentCycleStart: Date | null
  now?: Date
  previousCycleEnd: Date | null
  previousCycleStart: Date | null
}) {
  const now = input.now ?? new Date()
  const ranges: Partial<
    Record<Exclude<UsageRangePresetKey, "custom">, UsageDateRange>
  > = {
    today: createUsageDateRange(startOfUtcDay(now), endOfUtcDay(now)),
    this_week: createUsageDateRange(startOfUtcWeek(now), endOfUtcWeek(now)),
    this_month: createUsageDateRange(startOfUtcMonth(now), endOfUtcMonth(now)),
    this_year: createUsageDateRange(startOfUtcYear(now), endOfUtcYear(now)),
    last_24h: createUsageDateRange(
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
      now,
    ),
    last_7d: createUsageDateRange(
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      now,
    ),
    last_30d: createUsageDateRange(
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      now,
    ),
    last_year: createUsageDateRange(
      startOfUtcYear(
        new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1, 0, 0, 0, 0)),
      ),
      endOfUtcYear(
        new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1, 0, 0, 0, 0)),
      ),
    ),
  }

  if (input.currentCycleStart) {
    ranges.current_cycle = createUsageDateRange(
      input.currentCycleStart,
      input.currentCycleEnd ?? endOfUtcMonth(input.currentCycleStart),
    )
  }

  if (input.previousCycleStart && input.previousCycleEnd) {
    ranges.previous_cycle = createUsageDateRange(
      input.previousCycleStart,
      input.previousCycleEnd,
    )
  }

  return ranges
}

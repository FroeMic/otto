import { CalendarBlank } from "@phosphor-icons/react/ssr"
import { Link } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useEffect, useMemo, useRef, useState } from "react"
import type { DateRange } from "react-day-picker"

import {
  SettingsCard,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { billingOverviewQueryOptions } from "@/features/billing/api/billing"

import {
  getDefaultUsageSearch,
  loadUsageOverview,
} from "../api/usage"
import type { UsageOverview } from "../types"

export interface WorkspaceUsageContentProps {
  locale: string
  orgSlug: string
}

interface DateRangeDropdownProps {
  activeLabel: string
  customRange: DateRange | undefined
  onCustomRangeChange: (range: DateRange | undefined) => void
}

const creditsChartConfig = {
  creditsBurned: {
    color: "var(--chart-1)",
    label: "Credits",
  },
} satisfies ChartConfig

function formatCredits(milli: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(Math.round(milli / 1000))
}

function formatCompact(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 10_000 ? 0 : 1,
    notation: "compact",
  }).format(value)
}

function formatDateRangeLabel(range: DateRange | undefined, locale: string) {
  if (!range?.from || !range.to) {
    return "Select range"
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return `${formatter.format(range.from)} – ${formatter.format(range.to)}`
}

function bucketKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function buildChartData(timeSeries: UsageOverview["timeSeries"], range: DateRange) {
  if (!range.from || !range.to) {
    return []
  }

  const valuesByKey = new Map<string, number>()

  for (const row of timeSeries) {
    if (!row.bucketStart) {
      continue
    }

    const key = bucketKey(new Date(row.bucketStart))
    valuesByKey.set(
      key,
      (valuesByKey.get(key) ?? 0) + (row.creditsBurnedMilli ?? 0) / 1000,
    )
  }

  const rows: Array<{ creditsBurned: number; label: string }> = []
  const cursor = new Date(range.from)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(range.to)
  end.setHours(0, 0, 0, 0)

  while (cursor <= end) {
    const current = new Date(cursor)
    const key = bucketKey(current)

    rows.push({
      creditsBurned: valuesByKey.get(key) ?? 0,
      label: new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
      }).format(current),
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return rows
}

export function WorkspaceUsageContent({
  locale,
  orgSlug,
}: WorkspaceUsageContentProps) {
  const { data: billingOverview } = useSuspenseQuery(
    billingOverviewQueryOptions(orgSlug),
  )
  const initialRange = useMemo(() => {
    const fallback = getDefaultUsageSearch()

    return {
      from: billingOverview.subscription?.currentPeriodStart
        ? new Date(billingOverview.subscription.currentPeriodStart)
        : new Date(fallback.from),
      to: billingOverview.subscription?.currentPeriodEnd
        ? new Date(billingOverview.subscription.currentPeriodEnd)
        : new Date(fallback.to),
    } satisfies DateRange
  }, [
    billingOverview.subscription?.currentPeriodEnd,
    billingOverview.subscription?.currentPeriodStart,
  ])
  const [dateRange, setDateRange] = useState<DateRange>(initialRange)
  const [overview, setOverview] = useState<UsageOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    setDateRange(initialRange)
  }, [initialRange])

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!dateRange.from || !dateRange.to) {
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const nextOverview = await loadUsageOverview({
          orgSlug,
          search: {
            from: dateRange.from.toISOString(),
            to: dateRange.to.toISOString(),
          },
        })

        if (!cancelled) {
          setOverview(nextOverview)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error ? nextError.message : "Failed to load usage.",
          )
        }
      } finally {
        if (!cancelled) {
          hasLoadedRef.current = true
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [dateRange.from, dateRange.to, orgSlug])

  const currentOverview = overview
  const creditsChartData =
    dateRange.from && dateRange.to && currentOverview
      ? buildChartData(currentOverview.timeSeries, dateRange)
      : []

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <DateRangeDropdown
          activeLabel={formatDateRangeLabel(dateRange, locale)}
          customRange={dateRange}
          onCustomRangeChange={(nextRange) => {
            if (nextRange?.from && nextRange.to) {
              setDateRange(nextRange)
            }
          }}
        />
      </div>

      {error ? (
        <Alert className="rounded-lg" variant="destructive">
          <AlertTitle>Usage could not be loaded</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <SettingsCard>
          <SettingsRow>
            <SettingsRowLabel>
              <div className="text-sm text-muted-foreground">Sessions</div>
              <div className="text-2xl font-semibold tracking-tight">
                {isLoading || !currentOverview ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  new Intl.NumberFormat(locale).format(
                    currentOverview.summary.totalRequests,
                  )
                )}
              </div>
            </SettingsRowLabel>
          </SettingsRow>
        </SettingsCard>
        <SettingsCard>
          <SettingsRow>
            <SettingsRowLabel>
              <div className="text-sm text-muted-foreground">Credits used</div>
              <div className="text-2xl font-semibold tracking-tight">
                {isLoading || !currentOverview ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  formatCredits(
                    currentOverview.summary.totalCreditsBurnedMilli,
                    locale,
                  )
                )}
              </div>
            </SettingsRowLabel>
          </SettingsRow>
        </SettingsCard>
        <SettingsCard>
          <SettingsRow>
            <SettingsRowLabel>
              <div className="text-sm text-muted-foreground">
                Remaining credits
              </div>
              <div className="text-2xl font-semibold tracking-tight">
                {formatCredits(
                  billingOverview.balance.currentBalanceCreditsMilli,
                  locale,
                )}
              </div>
            </SettingsRowLabel>
          </SettingsRow>
        </SettingsCard>
      </div>

      <SettingsCard className="divide-y-0">
        <div className="px-5 pt-5 pb-1">
          <div className="text-sm font-medium">Usage over time</div>
        </div>
        <div className="px-5 pb-5">
          {isLoading || !currentOverview ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : (
            <ChartContainer className="h-72 w-full" config={creditsChartConfig}>
              <BarChart data={creditsChartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  interval="preserveStartEnd"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tickFormatter={(value) => formatCompact(value, locale)}
                  tickLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="text-muted-foreground">Credits</span>
                          <span className="font-mono font-medium text-foreground">
                            {formatCredits(Number(value) * 1000, locale)}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="creditsBurned"
                  fill="var(--color-creditsBurned)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </SettingsCard>

      <SettingsCard>
        <SettingsRow>
          <SettingsRowLabel>
            <SettingsRowTitle>Auto-reload credits</SettingsRowTitle>
            <div className="text-sm text-muted-foreground">
              {billingOverview.preferences.autoTopOffEnabled
                ? "Active — credits are added automatically when your balance is low."
                : "Off — enable in billing settings to automatically add credits."}
            </div>
          </SettingsRowLabel>
          <Link
            className="text-sm font-medium text-foreground hover:underline"
            params={{ orgSlug }}
            to="/$orgSlug/settings/workspace/billing"
          >
            {billingOverview.preferences.autoTopOffEnabled ? "Manage" : "Configure"}
          </Link>
        </SettingsRow>
      </SettingsCard>
    </div>
  )
}

function DateRangeDropdown({
  activeLabel,
  customRange,
  onCustomRangeChange,
}: DateRangeDropdownProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/80">
        <CalendarBlank className="size-3.5" weight="bold" />
        {activeLabel}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          defaultMonth={customRange?.from}
          mode="range"
          numberOfMonths={2}
          selected={customRange}
          onSelect={(range) => {
            onCustomRangeChange(range)

            if (range?.from && range.to) {
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

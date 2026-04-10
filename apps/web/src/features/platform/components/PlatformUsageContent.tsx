import { CalendarBlankIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"

import type { PlatformUsage } from "@otto/feature-platform"

import { platformUsageQueryOptions } from "@/features/platform/api/platform"
import {
  getUsagePresetDefinitions,
  getUsagePresetRanges,
  type UsageDatePresetDefinition,
  type UsageDateRange,
  type UsageRangePresetKey,
} from "@/features/usage/date-ranges"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface PlatformUsageContentProps {
  creditBalance: {
    currentBalanceCreditsMilli: number
    totalDebitedCreditsMilli: number
    totalGrantedCreditsMilli: number
  }
  currentCycleEndIso: string | null
  currentCycleStartIso: string | null
  locale: string
  orgSlug: string
  previousCycleEndIso: string | null
  previousCycleStartIso: string | null
  timezone: string
}

interface DateRangeDropdownProps {
  activePreset: Exclude<UsageRangePresetKey, "custom"> | null
  customRange: DateRange | undefined
  locale: string
  onCustomRangeChange: (range: DateRange | undefined) => void
  onPresetSelect: (key: Exclude<UsageRangePresetKey, "custom">) => void
  presets: UsageDatePresetDefinition[]
}

interface StatCardProps {
  label: string
  loading: boolean
  subtitle?: string
  value?: string
}

type SpendModality = "all" | "audio" | "image" | "text"

const ALL_USAGE_TYPES = [
  "completions",
  "embeddings",
  "audio_transcriptions",
  "audio_speeches",
  "images",
  "moderations",
  "code_interpreter_sessions",
  "vector_stores",
] as const

const REQUESTS_CHART_CONFIG = {
  requestCount: {
    color: "var(--chart-3)",
    label: "Requests",
  },
} satisfies ChartConfig

const SPEND_MODALITIES: Array<{ label: string; value: SpendModality }> = [
  { label: "All", value: "all" },
  { label: "Text", value: "text" },
  { label: "Audio", value: "audio" },
  { label: "Image", value: "image" },
]

function formatCompact(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 10_000 ? 0 : 1,
    notation: "compact",
  }).format(value)
}

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value)
}

function formatCredits(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(Math.round(value))
}

function formatCreditsFromMilli(value: number) {
  return Math.round(value / 1_000)
}

function formatDollarsFromMicros(value: number) {
  const dollars = value / 1_000_000

  if (dollars === 0) {
    return "$0.00"
  }

  if (dollars < 0.01) {
    return "<$0.01"
  }

  return `$${dollars.toFixed(2)}`
}

function formatUsageTypeLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => {
    return character.toUpperCase()
  })
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

function getSpendChartConfig(modality: SpendModality): ChartConfig {
  if (modality === "all") {
    return {
      outputTokens: { color: "var(--chart-2)", label: "Output" },
      inputTokens: { color: "var(--chart-1)", label: "Input" },
      inputCachedTokens: { color: "var(--chart-4)", label: "Input cached" },
    }
  }

  const prefix = modality.charAt(0).toUpperCase() + modality.slice(1)

  return {
    output: { color: "var(--chart-2)", label: `${prefix} output` },
    input: { color: "var(--chart-1)", label: `${prefix} input` },
  }
}

function bucketKey(isoString: string, hourly: boolean) {
  return hourly ? isoString.slice(0, 13) : isoString.slice(0, 10)
}

function generateTimeBuckets(from: Date, to: Date, hourly: boolean) {
  const keys: string[] = []
  const current = new Date(from)

  if (hourly) {
    current.setUTCMinutes(0, 0, 0)
  } else {
    current.setUTCHours(0, 0, 0, 0)
  }

  const stepMs = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000

  while (current <= to) {
    keys.push(bucketKey(current.toISOString(), hourly))
    current.setTime(current.getTime() + stepMs)
  }

  return keys
}

function getSpendChartData(
  timeSeries: PlatformUsage["timeSeries"],
  modality: SpendModality,
  timeFormatter: Intl.DateTimeFormat,
  dateRange: UsageDateRange,
) {
  const rangeMs = dateRange.to.getTime() - dateRange.from.getTime()
  const hourly = rangeMs <= 48 * 60 * 60 * 1000
  const allKeys = generateTimeBuckets(dateRange.from, dateRange.to, hourly)
  const dataByKey = new Map<string, PlatformUsage["timeSeries"][number]>()

  for (const row of timeSeries) {
    dataByKey.set(bucketKey(row.bucketTime, hourly), row)
  }

  return allKeys.map((key) => {
    const row = dataByKey.get(key)
    const bucketDate = new Date(
      hourly ? `${key}:00:00.000Z` : `${key}T00:00:00.000Z`,
    )
    const timeLabel = timeFormatter.format(bucketDate)

    if (modality === "text") {
      return {
        input: row?.inputTextTokens ?? 0,
        output: row?.outputTextTokens ?? 0,
        timeLabel,
      }
    }

    if (modality === "audio") {
      return {
        input: row?.inputAudioTokens ?? 0,
        output: row?.outputAudioTokens ?? 0,
        timeLabel,
      }
    }

    if (modality === "image") {
      return {
        input: row?.inputImageTokens ?? 0,
        output: 0,
        timeLabel,
      }
    }

    return {
      inputCachedTokens: row?.inputCachedTokens ?? 0,
      inputTokens: row?.inputTokens ?? 0,
      outputTokens: row?.outputTokens ?? 0,
      timeLabel,
    }
  })
}

export function PlatformUsageContent({
  creditBalance,
  currentCycleEndIso,
  currentCycleStartIso,
  locale,
  orgSlug,
  previousCycleEndIso,
  previousCycleStartIso,
  timezone,
}: PlatformUsageContentProps) {
  const [activePreset, setActivePreset] = useState<
    Exclude<UsageRangePresetKey, "custom"> | null
  >(currentCycleStartIso ? "current_cycle" : "this_month")
  const [customRange, setCustomRange] = useState<DateRange | undefined>()
  const [spendModality, setSpendModality] = useState<SpendModality>("all")

  const currentCycleStart = currentCycleStartIso
    ? new Date(currentCycleStartIso)
    : null
  const currentCycleEnd = currentCycleEndIso ? new Date(currentCycleEndIso) : null
  const previousCycleStart = previousCycleStartIso
    ? new Date(previousCycleStartIso)
    : null
  const previousCycleEnd = previousCycleEndIso
    ? new Date(previousCycleEndIso)
    : null

  const presets = useMemo(() => {
    return getUsagePresetDefinitions({
      hasBillingCycle: Boolean(currentCycleStart),
      hasPreviousBillingCycle: Boolean(previousCycleStart && previousCycleEnd),
    })
  }, [currentCycleStart, previousCycleEnd, previousCycleStart])

  const presetRanges = useMemo(() => {
    return getUsagePresetRanges({
      currentCycleEnd,
      currentCycleStart,
      previousCycleEnd,
      previousCycleStart,
    })
  }, [currentCycleEnd, currentCycleStart, previousCycleEnd, previousCycleStart])

  const dateRange = useMemo<UsageDateRange>(() => {
    if (activePreset !== null) {
      const presetRange = presetRanges[activePreset]

      if (presetRange) {
        return presetRange
      }
    }

    if (customRange?.from && customRange?.to) {
      return {
        from: customRange.from,
        to: customRange.to,
      }
    }

    const fallbackRange =
      presetRanges[currentCycleStart ? "current_cycle" : "this_month"] ??
      presetRanges.this_month

    if (!fallbackRange) {
      throw new Error("Missing default platform usage date range.")
    }

    return fallbackRange
  }, [activePreset, currentCycleStart, customRange, presetRanges])

  const { data, isLoading } = useQuery(
    platformUsageQueryOptions({
      from: dateRange.from.toISOString(),
      orgSlug,
      to: dateRange.to.toISOString(),
    }),
  )

  const timeFormatter = useMemo(() => {
    const rangeMs = dateRange.to.getTime() - dateRange.from.getTime()
    const isShort = rangeMs <= 48 * 60 * 60 * 1000

    return new Intl.DateTimeFormat(locale, {
      ...(isShort
        ? { hour: "numeric", minute: "2-digit" }
        : { day: "numeric", month: "short" }),
      timeZone: timezone,
    })
  }, [dateRange, locale, timezone])

  const usageByTypeComplete = useMemo(() => {
    const byType = new Map(
      (data?.usageByType ?? []).map((row) => [row.usageType, row]),
    )

    return ALL_USAGE_TYPES.map((usageType) => {
      return {
        creditsBurnedMilli: byType.get(usageType)?.creditsBurnedMilli ?? 0,
        providerCostMicros: byType.get(usageType)?.providerCostMicros ?? 0,
        requestCount: byType.get(usageType)?.requestCount ?? 0,
        totalTokens: byType.get(usageType)?.totalTokens ?? 0,
        usageType,
      }
    })
  }, [data?.usageByType])

  const spendChartConfig = getSpendChartConfig(spendModality)
  const spendChartData = data?.timeSeries
    ? getSpendChartData(data.timeSeries, spendModality, timeFormatter, dateRange)
    : []
  const spendDataKeys = Object.keys(spendChartConfig)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 px-4 pb-6 md:px-6">
      <DateRangeDropdown
        activePreset={activePreset}
        customRange={customRange}
        locale={locale}
        onCustomRangeChange={(range) => {
          setCustomRange(range)

          if (range?.from && range?.to) {
            setActivePreset(null)
          }
        }}
        onPresetSelect={(key) => {
          setActivePreset(key)
          setCustomRange(undefined)
        }}
        presets={presets}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Credit balance"
          loading={false}
          subtitle={`${formatCredits(formatCreditsFromMilli(creditBalance.totalGrantedCreditsMilli), locale)} granted · ${formatCredits(formatCreditsFromMilli(creditBalance.totalDebitedCreditsMilli), locale)} debited`}
          value={formatCredits(
            formatCreditsFromMilli(creditBalance.currentBalanceCreditsMilli),
            locale,
          )}
        />
        <StatCard
          label="Credits burned"
          loading={isLoading}
          subtitle="in selected period"
          value={
            data
              ? formatCredits(
                  formatCreditsFromMilli(data.summary.totalCreditsBurnedMilli),
                  locale,
                )
              : undefined
          }
        />
        <StatCard
          label="Cost"
          loading={isLoading}
          subtitle="OpenAI API spend"
          value={
            data
              ? formatDollarsFromMicros(data.summary.totalProviderCostMicros)
              : undefined
          }
        />
        <StatCard
          label="Total tokens"
          loading={isLoading}
          subtitle={
            data
              ? `${formatCompact(data.summary.totalInputTokens, locale)} in / ${formatCompact(data.summary.totalOutputTokens, locale)} out`
              : undefined
          }
          value={
            data
              ? formatCompact(
                  data.summary.totalInputTokens + data.summary.totalOutputTokens,
                  locale,
                )
              : undefined
          }
        />
        <StatCard
          label="Requests"
          loading={isLoading}
          subtitle={data ? `${data.summary.activeModels} models active` : undefined}
          value={data ? formatCompact(data.summary.totalRequests, locale) : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <CardTitle>Token usage over time</CardTitle>
                <CardDescription>Token breakdown by time period</CardDescription>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-muted p-[3px] text-xs">
                {SPEND_MODALITIES.map((modality) => (
                  <button
                    key={modality.value}
                    className={cn(
                      "inline-flex h-6 items-center justify-center rounded-full px-2 text-xs font-medium transition-colors",
                      spendModality === modality.value
                        ? "bg-background text-foreground"
                        : "text-foreground/60 hover:text-foreground",
                    )}
                    onClick={() => setSpendModality(modality.value)}
                    type="button"
                  >
                    {modality.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : !data?.timeSeries.length ? (
              <EmptyChartPlaceholder message="No usage data for this period." />
            ) : (
              <ChartContainer
                className="aspect-auto h-[280px] w-full"
                config={spendChartConfig}
              >
                <BarChart data={spendChartData} reverseStackOrder>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="timeLabel"
                    height={30}
                    interval="preserveStartEnd"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tickFormatter={(value: number) => formatCompact(value, locale)}
                    tickLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {spendDataKeys.map((key, index) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      fill={`var(--color-${key})`}
                      radius={index === 0 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                      stackId="tokens"
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Requests by type</CardTitle>
            <CardDescription>Request counts by modality</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ChartContainer
                className="aspect-auto h-[280px] w-full"
                config={REQUESTS_CHART_CONFIG}
              >
                <BarChart
                  accessibilityLayer
                  data={usageByTypeComplete.map((row) => ({
                    ...row,
                    usageTypeLabel: formatUsageTypeLabel(row.usageType),
                  }))}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    angle={-45}
                    axisLine={false}
                    dataKey="usageTypeLabel"
                    height={60}
                    interval={0}
                    textAnchor="end"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tickFormatter={(value: number) => formatCompact(value, locale)}
                    tickLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="requestCount"
                    fill="var(--color-requestCount)"
                    radius={[12, 12, 4, 4]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Top models</CardTitle>
          <CardDescription>
            Highest usage by model in the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : !data?.usageByModel.length ? (
            <EmptyChartPlaceholder message="No model usage data for this period." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>API cost</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Cost / 1k credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.usageByModel.map((row) => {
                  const credits = formatCreditsFromMilli(row.creditsBurnedMilli)
                  const costPer1kCredits =
                    credits > 0
                      ? formatDollarsFromMicros(
                          Math.round((row.providerCostMicros / credits) * 1000),
                        )
                      : "—"

                  return (
                    <TableRow key={`${row.usageType}-${row.model}`}>
                      <TableCell className="max-w-0 truncate font-mono text-xs">
                        {row.model}
                      </TableCell>
                      <TableCell>
                        {formatUsageTypeLabel(row.usageType)}
                      </TableCell>
                      <TableCell>{formatCount(row.requestCount, locale)}</TableCell>
                      <TableCell>{formatCount(row.totalTokens, locale)}</TableCell>
                      <TableCell>
                        {formatDollarsFromMicros(row.providerCostMicros)}
                      </TableCell>
                      <TableCell>{formatCredits(credits, locale)}</TableCell>
                      <TableCell>{costPer1kCredits}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, loading, subtitle, value }: StatCardProps) {
  return (
    <Card className="rounded-lg" size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle>
          {loading && !value ? <Skeleton className="h-7 w-20" /> : (value ?? "—")}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        {loading && !subtitle ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          (subtitle ?? "")
        )}
      </CardContent>
    </Card>
  )
}

function DateRangeDropdown({
  activePreset,
  customRange,
  locale,
  onCustomRangeChange,
  onPresetSelect,
  presets,
}: DateRangeDropdownProps) {
  const [open, setOpen] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const activeLabel =
    activePreset !== null
      ? (presets.find((preset) => preset.key === activePreset)?.label ??
        "Select range")
      : formatDateRangeLabel(customRange, locale)

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (!nextOpen) {
          setShowCalendar(false)
        }
      }}
    >
      <PopoverTrigger className="inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/80">
        <CalendarBlankIcon className="size-3.5" weight="bold" />
        {activeLabel}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {showCalendar ? (
          <div className="flex flex-col">
            <Calendar
              defaultMonth={customRange?.from}
              mode="range"
              numberOfMonths={2}
              onSelect={(range) => {
                onCustomRangeChange(range)

                if (range?.from && range?.to) {
                  setOpen(false)
                  setShowCalendar(false)
                }
              }}
              selected={customRange}
            />
          </div>
        ) : (
          <div className="flex flex-col py-1">
            {presets.map((preset) => (
              <button
                key={preset.key}
                className={cn(
                  "px-4 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  activePreset === preset.key
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
                onClick={() => {
                  onPresetSelect(preset.key)
                  setOpen(false)
                }}
                type="button"
              >
                {preset.label}
              </button>
            ))}
            <div className="my-1 h-px bg-border" />
            <button
              className="flex items-center gap-2 px-4 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setShowCalendar(true)}
              type="button"
            >
              <CalendarBlankIcon className="size-3.5" weight="bold" />
              Custom range…
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function EmptyChartPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-3xl border border-dashed border-border text-sm text-muted-foreground">
      {message}
    </div>
  )
}

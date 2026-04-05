"use client";

import { CalendarBlank } from "@phosphor-icons/react/ssr";
import { format } from "date-fns";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// --- Types ---

type TimeSeriesRow = {
  bucketTime: string;
  creditsBurnedMilli: number;
  providerCostMicros: number;
  inputTokens: number;
  outputTokens: number;
  inputCachedTokens: number;
  inputTextTokens: number;
  outputTextTokens: number;
  inputAudioTokens: number;
  outputAudioTokens: number;
  inputImageTokens: number;
  requestCount: number;
};

type UsageOverview = {
  summary: {
    activeApiKeys: number;
    activeModels: number;
    totalCreditsBurnedMilli: number;
    totalProviderCostMicros: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalRequests: number;
  };
  timeSeries: TimeSeriesRow[];
  usageByModel: Array<{
    creditsBurnedMilli: number;
    providerCostMicros: number;
    inputTokens: number;
    model: string;
    outputTokens: number;
    requestCount: number;
    totalTokens: number;
    usageType: string;
  }>;
  usageByType: Array<{
    creditsBurnedMilli: number;
    providerCostMicros: number;
    requestCount: number;
    totalTokens: number;
    usageType: string;
  }>;
};

type CreditBalance = {
  currentBalance: number;
  totalDebited: number;
  totalGranted: number;
};

// --- All usage types in OpenClaw ---

const ALL_USAGE_TYPES = [
  "completions",
  "embeddings",
  "audio_transcriptions",
  "audio_speeches",
  "images",
  "moderations",
  "code_interpreter_sessions",
  "vector_stores",
] as const;

// --- Date range presets ---

type DatePreset = {
  from: () => Date;
  label: string;
  to: () => Date;
};

const DATE_PRESETS: DatePreset[] = [
  { from: () => startOfDay(new Date()), label: "Today", to: () => new Date() },
  {
    from: () => startOfWeek(new Date()),
    label: "This week",
    to: () => new Date(),
  },
  {
    from: () => startOfMonth(new Date()),
    label: "This month",
    to: () => new Date(),
  },
  {
    from: () => startOfYear(new Date()),
    label: "This year",
    to: () => new Date(),
  },
  {
    from: () => new Date(Date.now() - 24 * 60 * 60 * 1000),
    label: "Last 24h",
    to: () => new Date(),
  },
  {
    from: () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    label: "Last 7d",
    to: () => new Date(),
  },
  {
    from: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    label: "Last 30d",
    to: () => new Date(),
  },
  {
    from: () => new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    label: "Last 365d",
    to: () => new Date(),
  },
];

const DEFAULT_PRESET_INDEX = 5; // Last 7d

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfMonth(d: Date) {
  const r = new Date(d);
  r.setDate(1);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

// --- Formatters ---

function formatCompact(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 10_000 ? 0 : 1,
    notation: "compact",
  }).format(value);
}

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatCredits(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatCreditsFromMilli(milli: number) {
  return Math.round(milli / 1000);
}

function formatDollarsFromMicros(micros: number) {
  const dollars = micros / 1_000_000;
  if (dollars === 0) return "$0.00";
  if (dollars < 0.01) return "<$0.01";
  return `$${dollars.toFixed(2)}`;
}

function formatUsageTypeLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Spend chart modality options ---

type SpendModality = "all" | "text" | "audio" | "image";

const SPEND_MODALITIES: Array<{ label: string; value: SpendModality }> = [
  { label: "All", value: "all" },
  { label: "Text", value: "text" },
  { label: "Audio", value: "audio" },
  { label: "Image", value: "image" },
];

function getSpendChartConfig(modality: SpendModality): ChartConfig {
  // Order: first key = bottom of stack, last key = top of stack.
  // Legend reads left-to-right in this same order.
  if (modality === "all") {
    return {
      inputCachedTokens: { color: "var(--chart-4)", label: "Cached input" },
      inputTokens: { color: "var(--chart-1)", label: "Input" },
      outputTokens: { color: "var(--chart-2)", label: "Output" },
    };
  }
  const prefix = modality.charAt(0).toUpperCase() + modality.slice(1);
  return {
    input: { color: "var(--chart-1)", label: `${prefix} input` },
    output: { color: "var(--chart-2)", label: `${prefix} output` },
  };
}

function bucketKey(isoString: string, hourly: boolean) {
  // Use the ISO prefix directly — matches server's date_trunc output
  return hourly ? isoString.slice(0, 13) : isoString.slice(0, 10);
}

function generateTimeBuckets(from: Date, to: Date, hourly: boolean): string[] {
  const keys: string[] = [];
  const current = new Date(from);
  // Truncate to hour/day boundary in UTC
  if (hourly) {
    current.setUTCMinutes(0, 0, 0);
  } else {
    current.setUTCHours(0, 0, 0, 0);
  }
  const stepMs = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  while (current <= to) {
    keys.push(bucketKey(current.toISOString(), hourly));
    current.setTime(current.getTime() + stepMs);
  }
  return keys;
}

function getSpendChartData(
  timeSeries: TimeSeriesRow[],
  modality: SpendModality,
  timeFormatter: Intl.DateTimeFormat,
  dateRange: { from: Date; to: Date },
) {
  const rangeMs = dateRange.to.getTime() - dateRange.from.getTime();
  const hourly = rangeMs <= 48 * 60 * 60 * 1000;
  const allKeys = generateTimeBuckets(dateRange.from, dateRange.to, hourly);

  // Index actual data by bucket key
  const dataByKey = new Map<string, TimeSeriesRow>();
  for (const row of timeSeries) {
    dataByKey.set(bucketKey(row.bucketTime, hourly), row);
  }

  return allKeys.map((key) => {
    const row = dataByKey.get(key);
    // Parse the key back to a date for formatting
    const bucketDate = new Date(
      hourly ? `${key}:00:00.000Z` : `${key}T00:00:00.000Z`,
    );
    const timeLabel = timeFormatter.format(bucketDate);

    if (modality === "text") {
      return {
        timeLabel,
        input: row?.inputTextTokens ?? 0,
        output: row?.outputTextTokens ?? 0,
      };
    }
    if (modality === "audio") {
      return {
        timeLabel,
        input: row?.inputAudioTokens ?? 0,
        output: row?.outputAudioTokens ?? 0,
      };
    }
    if (modality === "image") {
      return { timeLabel, input: row?.inputImageTokens ?? 0, output: 0 };
    }
    return {
      timeLabel,
      inputTokens: row?.inputTokens ?? 0,
      outputTokens: row?.outputTokens ?? 0,
      inputCachedTokens: row?.inputCachedTokens ?? 0,
    };
  });
}

// --- Chart configs ---

const requestsChartConfig = {
  requestCount: {
    color: "var(--chart-3)",
    label: "Requests",
  },
} satisfies ChartConfig;

// --- Props ---

type PlatformUsageContentProps = {
  creditBalance: CreditBalance;
  locale: string;
  orgSlug: string;
  timezone: string;
};

export function PlatformUsageContent({
  creditBalance,
  locale,
  orgSlug,
  timezone,
}: PlatformUsageContentProps) {
  const [activePreset, setActivePreset] = React.useState<number | null>(
    DEFAULT_PRESET_INDEX,
  );
  const [customRange, setCustomRange] = React.useState<DateRange | undefined>();
  const [data, setData] = React.useState<UsageOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [spendModality, setSpendModality] =
    React.useState<SpendModality>("all");

  const dateRange = React.useMemo(() => {
    if (activePreset !== null) {
      const preset = DATE_PRESETS[activePreset];
      return { from: preset.from(), to: preset.to() };
    }
    if (customRange?.from && customRange?.to) {
      return { from: customRange.from, to: customRange.to };
    }
    const preset = DATE_PRESETS[DEFAULT_PRESET_INDEX];
    return { from: preset.from(), to: preset.to() };
  }, [activePreset, customRange]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const url = `/api/platform/organizations/${orgSlug}/usage?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`;

    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setData(json as UsageOverview);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug, dateRange]);

  const timeFormatter = React.useMemo(() => {
    const rangeMs = dateRange.to.getTime() - dateRange.from.getTime();
    const isShort = rangeMs <= 48 * 60 * 60 * 1000;
    return new Intl.DateTimeFormat(locale, {
      ...(isShort
        ? { hour: "numeric", minute: "2-digit" }
        : { month: "short", day: "numeric" }),
      timeZone: timezone,
    });
  }, [locale, timezone, dateRange]);

  const summary = data?.summary;

  // Build usageByType with all types present (even if 0)
  const usageByTypeComplete = React.useMemo(() => {
    const byType = new Map(
      (data?.usageByType ?? []).map((row) => [row.usageType, row]),
    );
    return ALL_USAGE_TYPES.map((type) => ({
      creditsBurnedMilli: byType.get(type)?.creditsBurnedMilli ?? 0,
      providerCostMicros: byType.get(type)?.providerCostMicros ?? 0,
      requestCount: byType.get(type)?.requestCount ?? 0,
      totalTokens: byType.get(type)?.totalTokens ?? 0,
      usageType: type,
    }));
  }, [data?.usageByType]);

  const spendChartConfig = getSpendChartConfig(spendModality);
  const spendChartData = data?.timeSeries
    ? getSpendChartData(
        data.timeSeries,
        spendModality,
        timeFormatter,
        dateRange,
      )
    : [];
  const spendDataKeys = Object.keys(spendChartConfig);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 px-4 pb-6 md:px-6">
      {/* Date range dropdown */}
      <DateRangeDropdown
        activePreset={activePreset}
        customRange={customRange}
        onCustomRangeChange={(range) => {
          setCustomRange(range);
          if (range?.from && range?.to) {
            setActivePreset(null);
          }
        }}
        onPresetSelect={(index) => {
          setActivePreset(index);
          setCustomRange(undefined);
        }}
      />

      {/* Summary stat cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Credit balance"
          loading={false}
          subtitle={`${formatCredits(creditBalance.totalGranted, locale)} granted · ${formatCredits(creditBalance.totalDebited, locale)} debited`}
          value={formatCredits(creditBalance.currentBalance, locale)}
        />
        <StatCard
          label="Credits burned"
          loading={loading}
          subtitle="in selected period"
          value={
            summary
              ? formatCredits(
                  formatCreditsFromMilli(summary.totalCreditsBurnedMilli),
                  locale,
                )
              : undefined
          }
        />
        <StatCard
          label="Cost"
          loading={loading}
          subtitle="OpenAI API spend"
          value={
            summary
              ? formatDollarsFromMicros(summary.totalProviderCostMicros)
              : undefined
          }
        />
        <StatCard
          label="Total tokens"
          loading={loading}
          subtitle={
            summary
              ? `${formatCompact(summary.totalInputTokens, locale)} in / ${formatCompact(summary.totalOutputTokens, locale)} out`
              : undefined
          }
          value={
            summary
              ? formatCompact(
                  summary.totalInputTokens + summary.totalOutputTokens,
                  locale,
                )
              : undefined
          }
        />
        <StatCard
          label="Requests"
          loading={loading}
          subtitle={
            summary ? `${summary.activeModels} models active` : undefined
          }
          value={
            summary ? formatCompact(summary.totalRequests, locale) : undefined
          }
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <CardTitle>Token usage over time</CardTitle>
                <CardDescription>
                  Token breakdown by time period
                </CardDescription>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-muted p-[3px] text-xs">
                {SPEND_MODALITIES.map((m) => (
                  <button
                    key={m.value}
                    className={cn(
                      "inline-flex h-6 items-center justify-center rounded-full px-2 text-xs font-medium transition-colors",
                      spendModality === m.value
                        ? "bg-background text-foreground"
                        : "text-foreground/60 hover:text-foreground",
                    )}
                    onClick={() => setSpendModality(m.value)}
                    type="button"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : !data?.timeSeries.length ? (
              <EmptyChartPlaceholder message="No usage data for this period." />
            ) : (
              <ChartContainer
                className="aspect-auto h-[280px] w-full"
                config={spendChartConfig}
              >
                <BarChart data={spendChartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="timeLabel"
                    tickLine={false}
                    interval="preserveStartEnd"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickFormatter={(v: number) => formatCompact(v, locale)}
                    tickLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {spendDataKeys.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      fill={`var(--color-${key})`}
                      stackId="tokens"
                      radius={
                        key === spendDataKeys[spendDataKeys.length - 1]
                          ? [2, 2, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requests by type</CardTitle>
            <CardDescription>Request counts by modality</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ChartContainer
                className="aspect-auto h-[280px] w-full"
                config={requestsChartConfig}
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
                    axisLine={false}
                    dataKey="usageTypeLabel"
                    tickLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickFormatter={(v: number) => formatCompact(v, locale)}
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

      {/* Top models table */}
      <Card>
        <CardHeader>
          <CardTitle>Top models</CardTitle>
          <CardDescription>
            Highest usage by model in the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
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
                  const credits = formatCreditsFromMilli(
                    row.creditsBurnedMilli,
                  );
                  const costPer1kCredits =
                    credits > 0
                      ? formatDollarsFromMicros(
                          Math.round((row.providerCostMicros / credits) * 1000),
                        )
                      : "—";
                  return (
                    <TableRow key={`${row.usageType}-${row.model}`}>
                      <TableCell className="max-w-0 truncate font-mono text-xs">
                        {row.model}
                      </TableCell>
                      <TableCell>
                        {formatUsageTypeLabel(row.usageType)}
                      </TableCell>
                      <TableCell>
                        {formatCount(row.requestCount, locale)}
                      </TableCell>
                      <TableCell>
                        {formatCount(row.totalTokens, locale)}
                      </TableCell>
                      <TableCell>
                        {formatDollarsFromMicros(row.providerCostMicros)}
                      </TableCell>
                      <TableCell>{formatCredits(credits, locale)}</TableCell>
                      <TableCell>{costPer1kCredits}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Sub-components ---

function StatCard({
  label,
  loading,
  subtitle,
  value,
}: {
  label: string;
  loading: boolean;
  subtitle?: string;
  value?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle>
          {loading && !value ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            (value ?? "—")
          )}
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
  );
}

function DateRangeDropdown({
  activePreset,
  customRange,
  onCustomRangeChange,
  onPresetSelect,
}: {
  activePreset: number | null;
  customRange: DateRange | undefined;
  onCustomRangeChange: (range: DateRange | undefined) => void;
  onPresetSelect: (index: number) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [showCalendar, setShowCalendar] = React.useState(false);

  const activeLabel =
    activePreset !== null
      ? DATE_PRESETS[activePreset].label
      : customRange?.from && customRange?.to
        ? `${format(customRange.from, "MMM d, yyyy")} – ${format(customRange.to, "MMM d, yyyy")}`
        : "Select range";

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setShowCalendar(false);
      }}
    >
      <PopoverTrigger className="inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/80">
        <CalendarBlank className="size-3.5" weight="bold" />
        {activeLabel}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {showCalendar ? (
          <div className="flex flex-col">
            <Calendar
              defaultMonth={customRange?.from}
              mode="range"
              numberOfMonths={2}
              selected={customRange}
              onSelect={(range) => {
                onCustomRangeChange(range);
                if (range?.from && range?.to) {
                  setOpen(false);
                  setShowCalendar(false);
                }
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col py-1">
            {DATE_PRESETS.map((preset, index) => (
              <button
                key={preset.label}
                className={cn(
                  "px-4 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  activePreset === index
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
                onClick={() => {
                  onPresetSelect(index);
                  setOpen(false);
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
              <CalendarBlank className="size-3.5" weight="bold" />
              Custom range…
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function EmptyChartPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-3xl border border-dashed border-border text-sm text-muted-foreground">
      {message}
    </div>
  );
}

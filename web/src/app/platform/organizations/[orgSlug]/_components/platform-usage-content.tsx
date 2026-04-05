"use client";

import * as React from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarBlank } from "@phosphor-icons/react/ssr";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  timeSeries: Array<{
    bucketTime: string;
    creditsBurnedMilli: number;
    providerCostMicros: number;
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
  }>;
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

// --- Date range presets ---

type DatePreset = {
  from: () => Date;
  label: string;
  to: () => Date;
};

const DATE_PRESETS: DatePreset[] = [
  {
    from: () => startOfDay(new Date()),
    label: "Today",
    to: () => new Date(),
  },
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
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Chart configs ---

const spendChartConfig = {
  providerCost: {
    color: "var(--chart-1)",
    label: "Estimated cost ($)",
  },
} satisfies ChartConfig;

const requestsChartConfig = {
  requestCount: {
    color: "var(--chart-3)",
    label: "Requests",
  },
} satisfies ChartConfig;

// --- Props ---

type PlatformUsageContentProps = {
  locale: string;
  orgSlug: string;
  timezone: string;
};

export function PlatformUsageContent({
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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 px-4 pb-6 md:px-6">
      {/* Date range picker */}
      <DateRangePicker
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
          subtitle="Coming soon"
          value="—"
        />
        <StatCard
          label="Credits burned"
          loading={loading}
          subtitle="in selected period"
          value={
            summary
              ? formatCount(formatCreditsFromMilli(summary.totalCreditsBurnedMilli), locale)
              : undefined
          }
        />
        <StatCard
          label="Estimated cost"
          loading={loading}
          subtitle="OpenAI spend"
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
            summary
              ? `${summary.activeModels} models active`
              : undefined
          }
          value={
            summary
              ? formatCompact(summary.totalRequests, locale)
              : undefined
          }
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Spend over time</CardTitle>
            <CardDescription>Estimated OpenAI cost by time period</CardDescription>
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
                <AreaChart
                  data={data.timeSeries.map((row) => ({
                    ...row,
                    providerCost: row.providerCostMicros / 1_000_000,
                    timeLabel: timeFormatter.format(new Date(row.bucketTime)),
                  }))}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis axisLine={false} dataKey="timeLabel" tickLine={false} />
                  <YAxis
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      v === 0 ? "$0" : `$${v.toFixed(2)}`
                    }
                    tickLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, _name, item) => {
                          const row = item.payload;
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span>{formatDollarsFromMicros(row.providerCostMicros)}</span>
                              <span className="text-muted-foreground">
                                {formatCount(formatCreditsFromMilli(row.creditsBurnedMilli), locale)} credits
                              </span>
                              <span className="text-muted-foreground">
                                {formatCompact(row.inputTokens + row.outputTokens, locale)} tokens
                              </span>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    dataKey="providerCost"
                    fill="var(--color-providerCost)"
                    fillOpacity={0.2}
                    stroke="var(--color-providerCost)"
                    type="monotone"
                  />
                </AreaChart>
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
            ) : !data?.usageByType.length ? (
              <EmptyChartPlaceholder message="No usage data for this period." />
            ) : (
              <ChartContainer
                className="aspect-auto h-[280px] w-full"
                config={requestsChartConfig}
              >
                <BarChart
                  accessibilityLayer
                  data={data.usageByType.map((row) => ({
                    ...row,
                    usageTypeLabel: formatUsageTypeLabel(row.usageType),
                  }))}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="usageTypeLabel"
                    tickLine={false}
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
                  <TableHead>Credits</TableHead>
                  <TableHead>Cost ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.usageByModel.map((row) => (
                  <TableRow key={`${row.usageType}-${row.model}`}>
                    <TableCell className="max-w-0 truncate font-mono text-xs">
                      {row.model}
                    </TableCell>
                    <TableCell>{formatUsageTypeLabel(row.usageType)}</TableCell>
                    <TableCell>
                      {formatCount(row.requestCount, locale)}
                    </TableCell>
                    <TableCell>
                      {formatCount(row.totalTokens, locale)}
                    </TableCell>
                    <TableCell>
                      {formatCount(formatCreditsFromMilli(row.creditsBurnedMilli), locale)}
                    </TableCell>
                    <TableCell>
                      {formatDollarsFromMicros(row.providerCostMicros)}
                    </TableCell>
                  </TableRow>
                ))}
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

function DateRangePicker({
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-muted p-[3px] text-xs text-muted-foreground">
        {DATE_PRESETS.map((preset, index) => (
          <button
            key={preset.label}
            className={cn(
              "inline-flex h-7 items-center justify-center rounded-full border border-transparent px-2.5 text-xs font-medium transition-colors hover:text-foreground",
              activePreset === index
                ? "bg-background text-foreground"
                : "text-foreground/60",
            )}
            onClick={() => onPresetSelect(index)}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <Popover>
        <PopoverTrigger
          className={cn(
            "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-transparent bg-muted px-3 text-xs font-medium transition-colors hover:text-foreground",
            activePreset === null
              ? "bg-background text-foreground ring-1 ring-foreground/10"
              : "text-foreground/60",
          )}
        >
          <CalendarBlank className="size-3.5" weight="bold" />
          {customRange?.from && customRange?.to
            ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d")}`
            : "Custom"}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            defaultMonth={customRange?.from}
            mode="range"
            numberOfMonths={2}
            selected={customRange}
            onSelect={onCustomRangeChange}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function EmptyChartPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-3xl border border-dashed border-border text-sm text-muted-foreground">
      {message}
    </div>
  );
}

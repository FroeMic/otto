"use client";

import { CalendarBlank } from "@phosphor-icons/react/ssr";
import { format } from "date-fns";
import Link from "next/link";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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

type UsageOverview = {
  summary: {
    activeApiKeys: number;
    activeModels: number;
    totalCreditsBurnedMilli: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalProviderCostMicros: number;
    totalRequests: number;
  };
  timeSeries: Array<{
    bucketTime: string;
    creditsBurnedMilli: number;
    requestCount: number;
  }>;
  usageByModel: Array<{
    creditsBurnedMilli: number;
    model: string;
    requestCount: number;
    usageType: string;
  }>;
  usageByType: Array<{
    creditsBurnedMilli: number;
    requestCount: number;
    usageType: string;
  }>;
};

type WorkspaceUsageContentProps = {
  currentBalanceCreditsMilli: number;
  currentCycleStartIso: string;
  initialOverview: UsageOverview;
  initialRange: {
    from: string;
    to: string;
  };
  locale: string;
  orgSlug: string;
};

type Granularity = "day" | "hour" | "week";
type RangePresetKey =
  | "current_cycle"
  | "last_30d"
  | "last_7d"
  | "this_month"
  | "custom";

const creditsChartConfig = {
  creditsBurned: {
    color: "var(--chart-1)",
    label: "Credits burned",
  },
} satisfies ChartConfig;

const usageTypeChartConfig = {
  creditsBurned: {
    color: "var(--chart-2)",
    label: "Credits burned",
  },
} satisfies ChartConfig;

function formatCredits(milli: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: milli % 1000 === 0 ? 0 : 3,
  }).format(milli / 1000);
}

function formatCompact(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 10_000 ? 0 : 1,
    notation: "compact",
  }).format(value);
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfHour(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  return next;
}

function getGranularity(from: Date, to: Date): Granularity {
  const rangeMs = to.getTime() - from.getTime();

  if (rangeMs <= 48 * 60 * 60 * 1000) {
    return "hour";
  }

  if (rangeMs > 90 * 24 * 60 * 60 * 1000) {
    return "week";
  }

  return "day";
}

function floorDate(date: Date, granularity: Granularity) {
  if (granularity === "hour") {
    return startOfHour(date);
  }

  if (granularity === "week") {
    return startOfWeek(date);
  }

  return startOfDay(date);
}

function advanceDate(date: Date, granularity: Granularity) {
  const next = new Date(date);

  if (granularity === "hour") {
    next.setHours(next.getHours() + 1);
    return next;
  }

  if (granularity === "week") {
    next.setDate(next.getDate() + 7);
    return next;
  }

  next.setDate(next.getDate() + 1);
  return next;
}

function bucketKey(date: Date, granularity: Granularity) {
  if (granularity === "hour") {
    return date.toISOString().slice(0, 13);
  }

  return date.toISOString().slice(0, 10);
}

function formatBucketLabel(date: Date, granularity: Granularity) {
  if (granularity === "hour") {
    return format(date, "MMM d, HH:00");
  }

  if (granularity === "week") {
    return `Week of ${format(date, "MMM d")}`;
  }

  return format(date, "MMM d");
}

function getCreditsChartData(
  timeSeries: UsageOverview["timeSeries"],
  from: Date,
  to: Date,
) {
  const granularity = getGranularity(from, to);
  const aggregated = new Map<string, { creditsBurned: number; date: Date }>();

  for (const row of timeSeries) {
    const rowDate = new Date(row.bucketTime);
    const bucketDate = floorDate(rowDate, granularity);
    const key = bucketKey(bucketDate, granularity);
    const current = aggregated.get(key);
    const creditsBurned = row.creditsBurnedMilli / 1000;

    if (current) {
      current.creditsBurned += creditsBurned;
      continue;
    }

    aggregated.set(key, {
      creditsBurned,
      date: bucketDate,
    });
  }

  const chartData = [];
  let cursor = floorDate(from, granularity);
  const end = floorDate(to, granularity);

  while (cursor <= end) {
    const key = bucketKey(cursor, granularity);
    const match = aggregated.get(key);

    chartData.push({
      creditsBurned: match?.creditsBurned ?? 0,
      label: formatBucketLabel(cursor, granularity),
    });

    cursor = advanceDate(cursor, granularity);
  }

  return chartData;
}

function getDateRangeLabel(range: DateRange) {
  if (!range.from) {
    return "Select range";
  }

  if (!range.to) {
    return format(range.from, "MMM d, yyyy");
  }

  return `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`;
}

function createRange(from: Date, to: Date): DateRange {
  return {
    from,
    to,
  };
}

export function WorkspaceUsageContent({
  currentBalanceCreditsMilli,
  currentCycleStartIso,
  initialOverview,
  initialRange,
  locale,
  orgSlug,
}: WorkspaceUsageContentProps) {
  const [overview, setOverview] = React.useState(initialOverview);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] =
    React.useState<RangePresetKey>("current_cycle");
  const [dateRange, setDateRange] = React.useState<DateRange>(() =>
    createRange(new Date(initialRange.from), new Date(initialRange.to)),
  );
  const hasMountedRef = React.useRef(false);

  const presetRanges = {
    current_cycle: createRange(new Date(currentCycleStartIso), new Date()),
    last_30d: createRange(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(),
    ),
    last_7d: createRange(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      new Date(),
    ),
    this_month: createRange(startOfMonth(new Date()), new Date()),
  } satisfies Record<Exclude<RangePresetKey, "custom">, DateRange>;

  React.useEffect(() => {
    if (!dateRange.from || !dateRange.to) {
      return;
    }

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    let cancelled = false;

    const load = async () => {
      const fromDate = dateRange.from;
      const toDate = dateRange.to;

      if (!fromDate || !toDate) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        });
        const response = await fetch(
          `/api/workspace/${orgSlug}/usage?${params}`,
        );
        const body = (await response.json().catch(() => null)) as
          | UsageOverview
          | { message?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            body && "message" in body && body.message
              ? body.message
              : "Failed to load usage.",
          );
        }

        if (!cancelled && body && "summary" in body) {
          setOverview(body);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load usage.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [dateRange.from, dateRange.to, orgSlug]);

  const creditsChartData =
    dateRange.from && dateRange.to
      ? getCreditsChartData(overview.timeSeries, dateRange.from, dateRange.to)
      : [];
  const usageByType = overview.usageByType
    .map((row) => ({
      creditsBurned: row.creditsBurnedMilli / 1000,
      requestCount: row.requestCount,
      usageType: row.usageType.replaceAll("_", " "),
    }))
    .sort((left, right) => right.creditsBurned - left.creditsBurned);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
          <p className="text-sm text-muted-foreground">
            Track workspace usage in credits for the current billing cycle or a
            custom date range.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["current_cycle", "Current billing cycle"],
              ["last_7d", "Last 7 days"],
              ["last_30d", "Last 30 days"],
              ["this_month", "This month"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              onClick={() => {
                setSelectedPreset(key);
                setDateRange(presetRanges[key]);
              }}
              size="sm"
              variant={selectedPreset === key ? "secondary" : "outline"}
            >
              {label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  size="sm"
                  variant={
                    selectedPreset === "custom" ? "secondary" : "outline"
                  }
                >
                  <CalendarBlank data-icon="inline-start" />
                  {getDateRangeLabel(dateRange)}
                </Button>
              }
            />
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                initialFocus
                mode="range"
                numberOfMonths={2}
                selected={dateRange}
                onSelect={(nextRange) => {
                  if (!nextRange?.from || !nextRange.to) {
                    return;
                  }

                  setSelectedPreset("custom");
                  setDateRange(nextRange);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {error ? (
        <Alert className="rounded-lg" variant="destructive">
          <AlertTitle>Usage could not be loaded</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current balance</CardDescription>
            <CardTitle className="text-2xl">
              {formatCredits(currentBalanceCreditsMilli, locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Remaining spendable credits in this workspace.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Credits used</CardDescription>
            <CardTitle className="text-2xl">
              {formatCredits(overview.summary.totalCreditsBurnedMilli, locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Burned in the selected time range.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Requests</CardDescription>
            <CardTitle className="text-2xl">
              {new Intl.NumberFormat(locale).format(
                overview.summary.totalRequests,
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Counted across the selected time range.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Credits used over time</CardTitle>
            <CardDescription>
              Credits burned in the selected range, grouped by hour, day, or
              week depending on the duration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : (
              <ChartContainer
                className="h-72 w-full"
                config={creditsChartConfig}
              >
                <BarChart data={creditsChartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    minTickGap={24}
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
                            <span className="text-muted-foreground">
                              Credits burned
                            </span>
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
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto-reload credits</CardTitle>
            <CardDescription>
              Automatically add credit when you reach your minimum balance.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <div className="text-sm font-medium">Auto-reload is off</div>
              <div className="text-sm text-muted-foreground">
                Configure auto-reload settings in Billing.
              </div>
            </div>
            <Button
              className="w-full"
              render={<Link href={`/${orgSlug}/settings/workspace/billing`} />}
              variant="outline"
            >
              Open billing settings
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Credits by type</CardTitle>
            <CardDescription>
              Burn grouped by usage type for the selected range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : usageByType.length > 0 ? (
              <ChartContainer
                className="h-72 w-full"
                config={usageTypeChartConfig}
              >
                <BarChart
                  data={usageByType}
                  layout="vertical"
                  margin={{ left: 16, right: 16 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    axisLine={false}
                    tickFormatter={(value) => formatCompact(value, locale)}
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    axisLine={false}
                    dataKey="usageType"
                    tickLine={false}
                    type="category"
                    width={140}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              Credits burned
                            </span>
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
                    radius={8}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                No credit usage was recorded in this range yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top models</CardTitle>
            <CardDescription>
              Models with the highest credit burn in the selected range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : overview.usageByModel.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.usageByModel.slice(0, 8).map((row) => (
                    <TableRow key={`${row.usageType}-${row.model}`}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{row.model}</span>
                          <span className="text-xs text-muted-foreground">
                            {row.usageType.replaceAll("_", " ")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCredits(row.creditsBurnedMilli, locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat(locale).format(row.requestCount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                No model-level usage is available for this range yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

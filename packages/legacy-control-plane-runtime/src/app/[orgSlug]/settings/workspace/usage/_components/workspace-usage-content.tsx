"use client";

import { CalendarBlank } from "@phosphor-icons/react/ssr";
import { format } from "date-fns";
import Link from "next/link";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  SettingsCard,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
} from "../../../_components/settings-layout";
import { Alert, AlertDescription, AlertTitle } from "../../../../../../components/ui/alert";
import { Calendar } from "../../../../../../components/ui/calendar";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../../../../../../components/ui/chart";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../../../components/ui/popover";
import { Skeleton } from "../../../../../../components/ui/skeleton";
import {
  getUsagePresetDefinitions,
  getUsagePresetRanges,
  type UsageDatePresetDefinition,
  type UsageRangePresetKey,
} from "../../../../../../lib/usage-date-ranges";
import { cn } from "../../../../../../lib/utils";

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
  autoReloadEnabled: boolean;
  currentBalanceCreditsMilli: number;
  currentCycleEndIso: string | null;
  currentCycleStartIso: string;
  initialOverview: UsageOverview;
  initialRange: {
    from: string;
    to: string;
  };
  locale: string;
  orgSlug: string;
  previousCycleEndIso: string | null;
  previousCycleStartIso: string | null;
};

const creditsChartConfig = {
  creditsBurned: {
    color: "var(--chart-1)",
    label: "Credits",
  },
} satisfies ChartConfig;

function formatCredits(milli: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(Math.round(milli / 1000));
}

function formatCompact(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 10_000 ? 0 : 1,
    notation: "compact",
  }).format(value);
}

// --- Time bucket helpers ---

type Granularity = "day" | "hour" | "week";

function getGranularity(from: Date, to: Date): Granularity {
  const rangeMs = to.getTime() - from.getTime();
  if (rangeMs <= 48 * 60 * 60 * 1000) return "hour";
  if (rangeMs > 90 * 24 * 60 * 60 * 1000) return "week";
  return "day";
}

function bucketKey(isoString: string, granularity: Granularity) {
  return granularity === "hour"
    ? isoString.slice(0, 13)
    : isoString.slice(0, 10);
}

function generateTimeBuckets(
  from: Date,
  to: Date,
  granularity: Granularity,
): string[] {
  const keys: string[] = [];
  const current = new Date(from);
  if (granularity === "hour") {
    current.setUTCMinutes(0, 0, 0);
  } else if (granularity === "week") {
    const day = current.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    current.setUTCDate(current.getUTCDate() + diff);
    current.setUTCHours(0, 0, 0, 0);
  } else {
    current.setUTCHours(0, 0, 0, 0);
  }
  const stepMs =
    granularity === "hour"
      ? 60 * 60 * 1000
      : granularity === "week"
        ? 7 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;
  while (current <= to) {
    keys.push(bucketKey(current.toISOString(), granularity));
    current.setTime(current.getTime() + stepMs);
  }
  return keys;
}

function formatBucketLabel(key: string, granularity: Granularity) {
  if (granularity === "hour") {
    const d = new Date(`${key}:00:00.000Z`);
    return format(d, "MMM d, HH:00");
  }
  const d = new Date(`${key}T00:00:00.000Z`);
  if (granularity === "week") {
    return `Week of ${format(d, "MMM d")}`;
  }
  return format(d, "MMM d");
}

function getCreditsChartData(
  timeSeries: UsageOverview["timeSeries"],
  from: Date,
  to: Date,
) {
  const granularity = getGranularity(from, to);
  const dataByKey = new Map<string, number>();

  for (const row of timeSeries) {
    const key = bucketKey(row.bucketTime, granularity);
    dataByKey.set(
      key,
      (dataByKey.get(key) ?? 0) + row.creditsBurnedMilli / 1000,
    );
  }

  const allKeys = generateTimeBuckets(from, to, granularity);
  return allKeys.map((key) => ({
    creditsBurned: dataByKey.get(key) ?? 0,
    label: formatBucketLabel(key, granularity),
  }));
}

function createRange(from: Date, to: Date): DateRange {
  return { from, to };
}

export function WorkspaceUsageContent({
  autoReloadEnabled,
  currentBalanceCreditsMilli,
  currentCycleEndIso,
  currentCycleStartIso,
  initialOverview,
  initialRange,
  locale,
  orgSlug,
  previousCycleEndIso,
  previousCycleStartIso,
}: WorkspaceUsageContentProps) {
  const [overview, setOverview] = React.useState(initialOverview);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] =
    React.useState<UsageRangePresetKey>("current_cycle");
  const [dateRange, setDateRange] = React.useState<DateRange>(() =>
    createRange(new Date(initialRange.from), new Date(initialRange.to)),
  );
  const hasMountedRef = React.useRef(false);

  const currentCycleEnd = currentCycleEndIso
    ? new Date(currentCycleEndIso)
    : null;
  const currentCycleStart = new Date(currentCycleStartIso);
  const previousCycleStart = previousCycleStartIso
    ? new Date(previousCycleStartIso)
    : null;
  const previousCycleEnd = previousCycleEndIso
    ? new Date(previousCycleEndIso)
    : null;
  const hasPreviousCycle = Boolean(previousCycleStart && previousCycleEnd);

  const presetList = React.useMemo(() => {
    return getUsagePresetDefinitions({
      hasBillingCycle: true,
      hasPreviousBillingCycle: hasPreviousCycle,
    });
  }, [hasPreviousCycle]);

  const presetRanges = React.useMemo(() => {
    return getUsagePresetRanges({
      currentCycleEnd,
      currentCycleStart,
      previousCycleEnd,
      previousCycleStart,
    });
  }, [
    currentCycleEnd,
    currentCycleStart,
    previousCycleEnd,
    previousCycleStart,
  ]);

  React.useEffect(() => {
    if (!dateRange.from || !dateRange.to) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (!dateRange.from || !dateRange.to) return;
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
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
        if (!cancelled) setIsLoading(false);
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

  const activeLabel =
    selectedPreset !== "custom"
      ? (presetList.find((p) => p.key === selectedPreset)?.label ??
        "Select range")
      : dateRange.from && dateRange.to
        ? `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`
        : "Select range";

  return (
    <div className="flex flex-col gap-8">
      {/* Heading + date range dropdown */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <DateRangeDropdown
          activeLabel={activeLabel}
          customRange={dateRange}
          onCustomRangeChange={(range) => {
            if (range?.from && range?.to) {
              setSelectedPreset("custom");
              setDateRange(range);
            }
          }}
          onPresetSelect={(key) => {
            setSelectedPreset(key);
            const nextRange = presetRanges[key];
            if (nextRange) {
              setDateRange(nextRange);
            }
          }}
          presets={presetList}
          selectedPreset={selectedPreset}
        />
      </div>

      {error ? (
        <Alert className="rounded-lg" variant="destructive">
          <AlertTitle>Usage could not be loaded</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <SettingsCard>
          <SettingsRow>
            <SettingsRowLabel>
              <div className="text-sm text-muted-foreground">Sessions</div>
              <div className="text-2xl font-semibold tracking-tight">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  new Intl.NumberFormat(locale).format(
                    overview.summary.totalRequests,
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
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  formatCredits(
                    overview.summary.totalCreditsBurnedMilli,
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
                {formatCredits(currentBalanceCreditsMilli, locale)}
              </div>
            </SettingsRowLabel>
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* Usage over time chart — single column */}
      <SettingsCard className="divide-y-0">
        <div className="px-5 pt-5 pb-1">
          <div className="text-sm font-medium">Usage over time</div>
        </div>
        <div className="px-5 pb-5">
          {isLoading ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : (
            <ChartContainer className="h-72 w-full" config={creditsChartConfig}>
              <BarChart data={creditsChartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  tickLine={false}
                  interval="preserveStartEnd"
                  tick={{ fontSize: 11 }}
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

      {/* Auto-reload row */}
      <SettingsCard>
        <SettingsRow>
          <SettingsRowLabel>
            <SettingsRowTitle>Auto-reload credits</SettingsRowTitle>
            <div className="text-sm text-muted-foreground">
              {autoReloadEnabled
                ? "Active — credits are added automatically when your balance is low."
                : "Off — enable in billing settings to automatically add credits."}
            </div>
          </SettingsRowLabel>
          <Link
            className="text-sm font-medium text-foreground hover:underline"
            href={`/${orgSlug}/settings/workspace/billing`}
          >
            {autoReloadEnabled ? "Manage" : "Configure"}
          </Link>
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}

// --- Date range dropdown ---

function DateRangeDropdown({
  activeLabel,
  customRange,
  onCustomRangeChange,
  onPresetSelect,
  presets,
  selectedPreset,
}: {
  activeLabel: string;
  customRange: DateRange | undefined;
  onCustomRangeChange: (range: DateRange | undefined) => void;
  onPresetSelect: (key: Exclude<UsageRangePresetKey, "custom">) => void;
  presets: UsageDatePresetDefinition[];
  selectedPreset: UsageRangePresetKey;
}) {
  const [open, setOpen] = React.useState(false);
  const [showCalendar, setShowCalendar] = React.useState(false);

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
      <PopoverContent align="end" className="w-auto p-0">
        {showCalendar ? (
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
        ) : (
          <div className="flex flex-col py-1">
            {presets.map((preset) => (
              <button
                key={preset.key}
                className={cn(
                  "px-4 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  selectedPreset === preset.key
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
                onClick={() => {
                  onPresetSelect(preset.key);
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

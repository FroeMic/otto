"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const tokensChartConfig = {
  inputTokens: {
    color: "var(--chart-1)",
    label: "Input tokens",
  },
  outputTokens: {
    color: "var(--chart-2)",
    label: "Output tokens",
  },
} satisfies ChartConfig;

const usageTypeChartConfig = {
  requestCount: {
    color: "var(--chart-3)",
    label: "Requests",
  },
} satisfies ChartConfig;

type PlatformUsageContentProps = {
  hourlyBuckets: Array<{
    creditsBurned: number;
    hourLabel: string;
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
  }>;
  lookbackLabel: string;
  locale: string;
  recentBuckets: Array<{
    apiKeyLabel: string;
    bucketLabel: string;
    creditsBurned: number;
    inputTokens: number;
    itemCount: number;
    modelLabel: string;
    outputTokens: number;
    settlementStatusLabel: string;
    usageTypeLabel: string;
  }>;
  summary: {
    activeApiKeys: number;
    activeModels: number;
    latestBucketLabel: string | null;
    totalCreditsBurned: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalRequests: number;
  };
  syncStates: Array<{
    consecutiveFailures: number;
    lastAttemptedLabel: string;
    lastError: string | null;
    lastRowCount: number;
    lastSuccessfulLabel: string;
    status: "attention" | "healthy" | "pending";
    usageTypeLabel: string;
  }>;
  usageByModel: Array<{
    creditsBurned: number;
    inputTokens: number;
    model: string;
    outputTokens: number;
    requestCount: number;
    totalTokens: number;
    usageTypeLabel: string;
  }>;
  usageByType: Array<{
    creditsBurned: number;
    requestCount: number;
    totalTokens: number;
    usageTypeLabel: string;
  }>;
};

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatCompactCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 10_000 ? 0 : 1,
    notation: "compact",
  }).format(value);
}

function formatCredits(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
    minimumFractionDigits: value > 0 && value < 1 ? 3 : 0,
  }).format(value);
}

function getSyncBadgeVariant(
  status: PlatformUsageContentProps["syncStates"][number]["status"],
) {
  switch (status) {
    case "healthy":
      return "secondary" as const;
    case "attention":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function PlatformUsageContent({
  hourlyBuckets,
  lookbackLabel,
  locale,
  recentBuckets,
  summary,
  syncStates,
  usageByModel,
  usageByType,
}: PlatformUsageContentProps) {
  const hasUsageData =
    hourlyBuckets.length > 0 ||
    recentBuckets.length > 0 ||
    summary.totalInputTokens > 0 ||
    summary.totalOutputTokens > 0 ||
    summary.totalRequests > 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 px-4 pb-6 md:px-6">
      <Alert className="rounded-3xl">
        <AlertTitle>Raw provider usage</AlertTitle>
        <AlertDescription>
          This view shows the last {lookbackLabel} of OpenAI usage Otto stored
          for this workspace plus the current hardcoded v1 credit burndown
          settlement. Daily cost reconciliation is still a separate follow-up
          slice.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Input tokens</CardDescription>
            <CardTitle>
              {formatCompactCount(summary.totalInputTokens, locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {formatCount(summary.totalInputTokens, locale)} across the last{" "}
            {lookbackLabel}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Output tokens</CardDescription>
            <CardTitle>
              {formatCompactCount(summary.totalOutputTokens, locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {formatCount(summary.totalOutputTokens, locale)} across the last{" "}
            {lookbackLabel}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Requests</CardDescription>
            <CardTitle>
              {formatCompactCount(summary.totalRequests, locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary.activeModels} models and {summary.activeApiKeys} API keys
            active
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Credits burned</CardDescription>
            <CardTitle>
              {formatCredits(summary.totalCreditsBurned, locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Derived from the v1 hardcoded pricing ruleset.
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Latest bucket</CardDescription>
            <CardTitle className="text-sm">
              {summary.latestBucketLabel ?? "No data yet"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Based on the latest stored provider bucket.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Token trend</CardTitle>
            <CardDescription>
              Input and output tokens by hour for the last {lookbackLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hourlyBuckets.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                No token buckets have been stored yet for this workspace.
              </div>
            ) : (
              <ChartContainer
                className="aspect-auto h-[280px] w-full"
                config={tokensChartConfig}
              >
                <AreaChart data={hourlyBuckets}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="hourLabel"
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tickFormatter={(value: number) =>
                      formatCompactCount(value, locale)
                    }
                    tickLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    dataKey="inputTokens"
                    fill="var(--color-inputTokens)"
                    fillOpacity={0.2}
                    stroke="var(--color-inputTokens)"
                    type="monotone"
                  />
                  <Area
                    dataKey="outputTokens"
                    fill="var(--color-outputTokens)"
                    fillOpacity={0.3}
                    stroke="var(--color-outputTokens)"
                    type="monotone"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requests by usage type</CardTitle>
            <CardDescription>
              Request counts by modality over the same window
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usageByType.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                No modality usage has been stored yet.
              </div>
            ) : (
              <ChartContainer
                className="aspect-auto h-[280px] w-full"
                config={usageTypeChartConfig}
              >
                <BarChart accessibilityLayer data={usageByType}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="usageTypeLabel"
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tickFormatter={(value: number) =>
                      formatCompactCount(value, locale)
                    }
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Sync state</CardTitle>
            <CardDescription>
              Current ingestion cursor and latest status by usage type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usage type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last success</TableHead>
                  <TableHead>Last attempt</TableHead>
                  <TableHead>Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncStates.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={5}>
                      No sync state has been recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  syncStates.map((state) => (
                    <TableRow key={state.usageTypeLabel}>
                      <TableCell className="font-medium">
                        {state.usageTypeLabel}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={getSyncBadgeVariant(state.status)}>
                            {state.status === "attention"
                              ? "Needs attention"
                              : state.status === "healthy"
                                ? "Healthy"
                                : "Pending"}
                          </Badge>
                          {state.lastError ? (
                            <div className="max-w-full break-words text-xs text-muted-foreground">
                              {state.lastError}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{state.lastSuccessfulLabel}</TableCell>
                      <TableCell>{state.lastAttemptedLabel}</TableCell>
                      <TableCell>
                        {formatCount(state.lastRowCount, locale)}
                        {state.consecutiveFailures > 0 ? (
                          <div className="text-xs text-muted-foreground">
                            {formatCount(state.consecutiveFailures, locale)}{" "}
                            failures
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top models</CardTitle>
            <CardDescription>
              Highest token volume by model in the last {lookbackLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageByModel.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={4}>
                      No model-attributed usage has been stored yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  usageByModel.map((row) => (
                    <TableRow key={`${row.usageTypeLabel}-${row.model}`}>
                      <TableCell className="max-w-0 truncate font-mono text-xs">
                        {row.model}
                      </TableCell>
                      <TableCell>{row.usageTypeLabel}</TableCell>
                      <TableCell>
                        {formatCount(row.requestCount, locale)}
                      </TableCell>
                      <TableCell>
                        {formatCount(row.totalTokens, locale)}
                      </TableCell>
                      <TableCell>
                        {formatCredits(row.creditsBurned, locale)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent raw buckets</CardTitle>
          <CardDescription>
            Latest stored provider buckets before any billable-unit or credit
            conversion
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasUsageData && recentBuckets.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              Usage ingestion is active, but no raw provider buckets have been
              stored yet for this workspace.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>API key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Input</TableHead>
                  <TableHead>Output</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBuckets.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={9}>
                      No raw provider buckets have been stored yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentBuckets.map((bucket) => (
                    <TableRow
                      key={`${bucket.bucketLabel}-${bucket.usageTypeLabel}-${bucket.modelLabel}-${bucket.apiKeyLabel}`}
                    >
                      <TableCell>{bucket.bucketLabel}</TableCell>
                      <TableCell>{bucket.usageTypeLabel}</TableCell>
                      <TableCell className="max-w-0 truncate font-mono text-xs">
                        {bucket.modelLabel}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {bucket.apiKeyLabel}
                      </TableCell>
                      <TableCell>{bucket.settlementStatusLabel}</TableCell>
                      <TableCell>
                        {formatCredits(bucket.creditsBurned, locale)}
                      </TableCell>
                      <TableCell>
                        {formatCount(bucket.itemCount, locale)}
                      </TableCell>
                      <TableCell>
                        {formatCount(bucket.inputTokens, locale)}
                      </TableCell>
                      <TableCell>
                        {formatCount(bucket.outputTokens, locale)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

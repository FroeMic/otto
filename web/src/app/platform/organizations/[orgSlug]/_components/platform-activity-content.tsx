"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type {
  PlatformActivityEventRow,
  PlatformActivityJobRow,
} from "@/app/platform/organizations/[orgSlug]/_lib/platform-activity-data";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

type PlatformActivityContentProps = {
  events: PlatformActivityEventRow[];
  jobs: PlatformActivityJobRow[];
  mode: "events" | "jobs";
  orgSlug: string;
};

type JobFilter = "all" | "apply";

const JOB_FILTER_OPTIONS = [
  { label: "All jobs", value: "all" },
  { label: "Apply only", value: "apply" },
] as const satisfies Array<{ label: string; value: JobFilter }>;

const EVENT_FILTER_OPTIONS = [
  { label: "All events", value: "all" },
  { label: "Apply only", value: "apply" },
] as const satisfies Array<{ label: string; value: JobFilter }>;

function buildJobsHref(input: { orgSlug: string; type: JobFilter }) {
  const searchParams = new URLSearchParams();

  if (input.type !== "all") {
    searchParams.set("type", input.type);
  }

  const query = searchParams.toString();

  return `/platform/organizations/${input.orgSlug}/jobs${query ? `?${query}` : ""}`;
}

function buildEventsHref(input: {
  jobId?: string | null;
  orgSlug: string;
  type: JobFilter;
}) {
  const searchParams = new URLSearchParams();

  if (input.type !== "all") {
    searchParams.set("type", input.type);
  }

  if (input.jobId) {
    searchParams.set("job", input.jobId);
  }

  const query = searchParams.toString();

  return `/platform/organizations/${input.orgSlug}/events${query ? `?${query}` : ""}`;
}

function truncateId(value: string) {
  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatFilterId(value: string) {
  return truncateId(value);
}

function IdCell({
  copied,
  fieldKey,
  hovered,
  id,
  onCopy,
  onHoverChange,
}: {
  copied: boolean;
  fieldKey: string;
  hovered: boolean;
  id: string;
  onCopy: () => void;
  onHoverChange: (hovered: boolean) => void;
}) {
  return (
    <Tooltip open={hovered || copied}>
      <TooltipTrigger
        render={
          <code
            data-copy-field={fieldKey}
            className="cursor-pointer select-text text-xs text-foreground"
            onClick={onCopy}
            onMouseEnter={() => onHoverChange(true)}
            onMouseLeave={() => onHoverChange(false)}
          />
        }
      >
        {truncateId(id)}
      </TooltipTrigger>
      <TooltipContent
        className={copied ? "bg-green-100 px-2 py-1 text-xs text-green-700" : "px-2 py-1 text-xs"}
        classNameTooltipArrow={copied ? "bg-green-100 text-green-700" : undefined}
      >
        {copied ? "Copied" : "Copy"}
      </TooltipContent>
    </Tooltip>
  );
}

const JOB_COLUMNS = ({
  copiedField,
  hoveredField,
  jobFilter,
  onCopy,
  onHoverChange,
  orgSlug,
}: {
  copiedField: string | null;
  hoveredField: string | null;
  jobFilter: JobFilter;
  onCopy: (value: string, field: string) => void;
  onHoverChange: (field: string | null) => void;
  orgSlug: string;
}): Array<ColumnDef<PlatformActivityJobRow>> => [
  {
    accessorKey: "id",
    header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
    size: 170,
    cell: ({ row }) => (
      <IdCell
        copied={copiedField === `job-id:${row.original.id}`}
        fieldKey={`job-id:${row.original.id}`}
        hovered={hoveredField === `job-id:${row.original.id}`}
        id={row.original.id}
        onCopy={() => onCopy(row.original.id, `job-id:${row.original.id}`)}
        onHoverChange={(hovered) =>
          onHoverChange(hovered ? `job-id:${row.original.id}` : null)
        }
      />
    ),
  },
  {
    accessorKey: "jobType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    size: 180,
    cell: ({ row }) => formatStatus(row.original.jobType),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={getStatusVariant(row.original.status)}>
        {formatStatus(row.original.status)}
      </Badge>
    ),
    size: 130,
  },
  {
    accessorKey: "step",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Step" />
    ),
    size: 180,
    cell: ({ row }) => formatStatus(row.original.step),
  },
  {
    accessorKey: "attempt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Attempt" />
    ),
    cell: ({ row }) => row.original.attempt + 1,
    size: 100,
  },
  {
    accessorKey: "eventsCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Events" />
    ),
    size: 120,
    cell: ({ row }) => (
      <Link
        href={buildEventsHref({
          jobId: row.original.id,
          orgSlug,
          type: jobFilter === "apply" ? "apply" : "all",
        })}
      >
        <Badge variant="outline">
          {row.original.eventsCount}{" "}
          {row.original.eventsCount === 1 ? "Event" : "Events"}
        </Badge>
      </Link>
    ),
  },
  {
    id: "startedAt",
    accessorFn: (row) =>
      row.startedAt?.getTime() ?? row.createdAt.getTime(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started" />
    ),
    size: 180,
    cell: ({ row }) =>
      formatTimestamp(row.original.startedAt ?? row.original.createdAt),
  },
  {
    id: "finishedAt",
    accessorFn: (row) => row.finishedAt?.getTime() ?? 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Finished" />
    ),
    size: 180,
    cell: ({ row }) => formatTimestamp(row.original.finishedAt),
  },
];

const EVENT_COLUMNS = ({
  copiedField,
  hoveredField,
  onCopy,
  onHoverChange,
}: {
  copiedField: string | null;
  hoveredField: string | null;
  onCopy: (value: string, field: string) => void;
  onHoverChange: (field: string | null) => void;
}): Array<ColumnDef<PlatformActivityEventRow>> => [
  {
    accessorKey: "id",
    header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
    size: 170,
    cell: ({ row }) => (
      <IdCell
        copied={copiedField === `event-id:${row.original.id}`}
        fieldKey={`event-id:${row.original.id}`}
        hovered={hoveredField === `event-id:${row.original.id}`}
        id={row.original.id}
        onCopy={() => onCopy(row.original.id, `event-id:${row.original.id}`)}
        onHoverChange={(hovered) =>
          onHoverChange(hovered ? `event-id:${row.original.id}` : null)
        }
      />
    ),
  },
  {
    id: "createdAt",
    accessorFn: (row) => row.createdAt.getTime(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Time" />
    ),
    size: 180,
    cell: ({ row }) => formatTimestamp(row.original.createdAt),
  },
  {
    accessorKey: "jobRunId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Job" />,
    size: 170,
    cell: ({ row }) => {
      const cellKey = `event-job-id:${row.original.id}`;

      return (
      <IdCell
        copied={copiedField === cellKey}
        fieldKey={cellKey}
        hovered={hoveredField === cellKey}
        id={row.original.jobRunId}
        onCopy={() => onCopy(row.original.jobRunId, cellKey)}
        onHoverChange={(hovered) =>
          onHoverChange(hovered ? cellKey : null)
        }
      />
      );
    },
  },
  {
    accessorKey: "jobType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Job type" />
    ),
    size: 170,
    cell: ({ row }) => formatStatus(row.original.jobType),
  },
  {
    accessorKey: "eventType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Event" />
    ),
    size: 180,
    cell: ({ row }) => formatStatus(row.original.eventType),
  },
  {
    accessorKey: "message",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Message" />
    ),
    size: 520,
    cell: ({ row }) => (
      <span className="block whitespace-normal break-words text-sm text-muted-foreground">
        {row.original.message}
      </span>
    ),
  },
];

export function PlatformActivityContent({
  events,
  jobs,
  mode,
  orgSlug,
}: PlatformActivityContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [autoRefreshEnabled, setAutoRefreshEnabled] = React.useState(true);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [hoveredField, setHoveredField] = React.useState<string | null>(null);

  const filter = searchParams.get("type") === "apply" ? "apply" : "all";
  const eventJobFilter = searchParams.get("job");

  React.useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 10_000);

    return () => window.clearInterval(intervalId);
  }, [autoRefreshEnabled, router]);

  const filteredJobs = React.useMemo(() => {
    if (filter === "apply") {
      return jobs.filter((job) => job.jobType === "apply_tenant_config");
    }

    return jobs;
  }, [filter, jobs]);

  const filteredEvents = React.useMemo(() => {
    let nextEvents = events;

    if (filter === "apply") {
      nextEvents = nextEvents.filter(
        (event) => event.jobType === "apply_tenant_config",
      );
    }

    if (eventJobFilter) {
      nextEvents = nextEvents.filter((event) => event.jobRunId === eventJobFilter);
    }

    return nextEvents;
  }, [eventJobFilter, events, filter]);

  async function copyToClipboard(value: string, field: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 2000);
  }

  function updateQuery(next: { job?: string | null; type?: JobFilter }) {
    const params = new URLSearchParams(searchParams.toString());

    if (!next.type || next.type === "all") {
      params.delete("type");
    } else {
      params.set("type", next.type);
    }

    if (!next.job) {
      params.delete("job");
    } else {
      params.set("job", next.job);
    }

    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`);
  }

  const jobsToolbar = (
    <div className="flex w-full min-w-0 items-center gap-2">
      <NativeSelect
        className="sm:w-40 sm:min-w-40 sm:max-w-40 sm:flex-none"
        onChange={(event) =>
          updateQuery({ job: null, type: event.target.value as JobFilter })
        }
        size="default"
        value={filter}
      >
        {JOB_FILTER_OPTIONS.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <div className="min-w-0 flex-1" />
      <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <span>Live updates</span>
        <Switch
          checked={autoRefreshEnabled}
          onCheckedChange={setAutoRefreshEnabled}
          size="sm"
        />
      </div>
    </div>
  );

  const eventsToolbar = (
    <div className="flex w-full min-w-0 items-center gap-2">
      <NativeSelect
        className="sm:w-40 sm:min-w-40 sm:max-w-40 sm:flex-none"
        onChange={(event) =>
          updateQuery({
            job: eventJobFilter,
            type: event.target.value as JobFilter,
          })
        }
        size="default"
        value={filter}
      >
        {EVENT_FILTER_OPTIONS.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <div className="flex min-w-0 flex-1 items-center">
        {eventJobFilter ? (
          <div className="flex min-w-0 items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Job</span>
            <code className="truncate text-foreground">
              {formatFilterId(eventJobFilter)}
            </code>
            <Button
              className="h-auto shrink-0 px-1.5 py-0.5 text-xs"
              onClick={() => updateQuery({ job: null, type: filter })}
              size="sm"
              type="button"
              variant="ghost"
            >
              Clear
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <span>Live updates</span>
        <Switch
          checked={autoRefreshEnabled}
          onCheckedChange={setAutoRefreshEnabled}
          size="sm"
        />
      </div>
    </div>
  );

  return mode === "jobs" ? (
    <DataTable
      bodyClassName="align-top"
      cellClassName="h-16 px-4 py-3 md:px-6"
      columns={JOB_COLUMNS({
        copiedField,
        hoveredField,
        jobFilter: filter,
        onCopy: copyToClipboard,
        onHoverChange: setHoveredField,
        orgSlug,
      })}
      data={filteredJobs}
      emptyMessage="No jobs found."
      fillAvailableSpace
      headClassName="h-11 px-4 text-sm font-medium text-foreground md:px-6"
      headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
      rowClassName="border-b-0 hover:bg-transparent"
      searchInputClassName="h-9 w-full sm:w-[26rem] sm:max-w-none sm:flex-none"
      searchKeys={["searchText"]}
      searchPlaceholder="Search jobs"
      tableClassName="min-w-full table-fixed"
      toolbar={jobsToolbar}
      toolbarClassName="pb-4 sm:flex-col sm:items-stretch lg:flex-row lg:items-center lg:justify-between"
      toolbarContentClassName="sm:w-full lg:w-auto"
      viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
    />
  ) : (
    <DataTable
      bodyClassName="align-top"
      cellClassName="h-16 px-4 py-3 md:px-6"
      columns={EVENT_COLUMNS({
        copiedField,
        hoveredField,
        onCopy: copyToClipboard,
        onHoverChange: setHoveredField,
      })}
      data={filteredEvents}
      emptyMessage="No events found."
      fillAvailableSpace
      headClassName="h-11 px-4 text-sm font-medium text-foreground md:px-6"
      headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
      rowClassName="border-b-0 hover:bg-transparent"
      searchInputClassName="h-9 w-full sm:w-[26rem] sm:max-w-none sm:flex-none"
      searchKeys={["searchText"]}
      searchPlaceholder="Search events"
      tableClassName="min-w-full table-fixed"
      toolbar={eventsToolbar}
      toolbarClassName="pb-4 sm:flex-col sm:items-stretch xl:flex-row xl:items-center xl:justify-between"
      toolbarContentClassName="sm:w-full lg:w-auto"
      viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
    />
  );
}

function formatTimestamp(value: Date | null) {
  if (!value) {
    return "Not available";
  }

  return value.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function formatStatus(status: string | null) {
  if (!status) {
    return "Not available";
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getStatusVariant(status: string | null) {
  switch (status) {
    case "connected":
    case "ready":
    case "succeeded":
      return "secondary" as const;
    case "failed":
    case "error":
    case "apply_failed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

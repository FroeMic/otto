"use client";

import {
  ArrowReloadHorizontalIcon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { PlatformOrganization } from "@/db/control-plane";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PlatformOrganizationsTableProps = {
  organizations: PlatformOrganization[];
};

type OrganizationAction = "apply" | "refresh-image";

type StatusTone = {
  dotClassName: string;
};

function getStatusTone(status: string | null): StatusTone {
  switch (status) {
    case "connected":
    case "ready":
    case "succeeded":
      return {
        dotClassName: "bg-emerald-500",
      };
    case "queued":
    case "running":
    case "pending_apply":
    case "provisioning":
      return {
        dotClassName: "bg-amber-500",
      };
    case "failed":
    case "error":
      return {
        dotClassName: "bg-destructive",
      };
    case "disconnected":
      return {
        dotClassName: "bg-muted-foreground/35",
      };
    default:
      return {
        dotClassName: "bg-muted-foreground/35",
      };
  }
}

function formatStatus(status: string | null) {
  if (!status) {
    return "Not available";
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatIsoTimestamp(value: Date | null) {
  return value ? value.toISOString() : null;
}

function getLatestSyncSummary(organization: PlatformOrganization) {
  if (organization.tenant?.latestApplyRun) {
    return {
      detail:
        organization.tenant.latestApplyRun.error ??
        `Desired state v${organization.tenant.latestApplyRun.desiredStateVersion}`,
      status: organization.tenant.latestApplyRun.status,
      timestamp:
        organization.tenant.latestApplyRun.finishedAt ??
        organization.tenant.latestApplyRun.startedAt,
    };
  }

  if (organization.tenant?.latestJob) {
    return {
      detail:
        organization.tenant.latestJob.error ??
        organization.tenant.latestJob.events[0]?.message ??
        "No recent runtime activity",
      status: organization.tenant.latestJob.status,
      timestamp:
        organization.tenant.latestJob.finishedAt ??
        organization.tenant.latestJob.startedAt ??
        organization.tenant.latestJob.events[0]?.createdAt ??
        null,
    };
  }

  return {
    detail: "No runtime activity yet",
    status: null,
    timestamp: null,
  };
}

function getRuntimeImageHref(image: string) {
  if (!image.startsWith("ghcr.io/")) {
    return null;
  }

  const [repository] = image.replace("ghcr.io/", "").split(":");
  const [owner, packageName] = repository.split("/");

  if (!owner || !packageName) {
    return null;
  }

  return `https://github.com/orgs/${owner}/packages/container/package/${packageName}`;
}

function InlineStatus({
  detail,
  status,
  value,
}: {
  detail?: string | null;
  status: string | null;
  value: string;
}) {
  const tone = getStatusTone(status);

  return (
    <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
      <HoverCard>
        <HoverCardTrigger className="flex shrink-0 items-center">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", tone.dotClassName)}
          />
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-auto min-w-32 rounded-2xl px-3 py-2"
        >
          <div className="text-xs font-medium text-foreground">
            {formatStatus(status)}
          </div>
          {detail ? (
            <div className="mt-1 max-w-56 text-xs leading-relaxed text-muted-foreground">
              {detail}
            </div>
          ) : null}
        </HoverCardContent>
      </HoverCard>
      <span className="truncate text-sm text-foreground">{value}</span>
    </div>
  );
}

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  const handleClick = React.useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setHovered(false);
    }, 1500);
  }, [value]);

  return (
    <Tooltip open={hovered || copied}>
      <TooltipTrigger
        render={
          <span
            className="cursor-pointer select-text truncate text-sm text-foreground"
            onClick={handleClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          />
        }
      >
        {value}
      </TooltipTrigger>
      <TooltipContent
        className={cn(
          "px-2 py-1 text-xs",
          copied && " bg-green-100 text-green-700 ",
        )}
        classNameTooltipArrow={
          copied ? " bg-green-100 text-green-700" : undefined
        }
      >
        {copied ? "Copied" : "Copy"}
      </TooltipContent>
    </Tooltip>
  );
}

function OrganizationActionsCell({
  organization,
}: {
  organization: PlatformOrganization;
}) {
  const router = useRouter();
  const [pendingAction, startTransition] = React.useTransition();
  const runtimeReady =
    organization.tenant?.status === "ready" &&
    organization.tenant.serverStatus === "ready";

  const runAction = (action: OrganizationAction) => {
    startTransition(async () => {
      const endpoint =
        action === "apply"
          ? `/api/platform/organizations/${organization.slug}/apply`
          : `/api/platform/organizations/${organization.slug}/refresh-image`;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
        });
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;

        if (!response.ok) {
          throw new Error(
            body?.message ??
              `Platform action failed with status ${response.status}.`,
          );
        }

        toast.success(
          action === "apply"
            ? "Queued runtime apply."
            : "Queued runtime image refresh.",
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Platform action failed.",
        );
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open organization actions"
            className="text-muted-foreground"
            disabled={pendingAction || !organization.tenant}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        {pendingAction ? (
          <HugeiconsIcon
            className="animate-spin"
            icon={ArrowReloadHorizontalIcon}
          />
        ) : (
          <HugeiconsIcon icon={MoreHorizontalIcon} />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={!runtimeReady || pendingAction}
          onClick={() => runAction("apply")}
        >
          Apply tenant config
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!runtimeReady || pendingAction}
          onClick={() => runAction("refresh-image")}
        >
          Pull and restart image
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columns: ColumnDef<PlatformOrganization>[] = [
  {
    accessorKey: "name",
    header: "Organization",
    cell: ({ row }) => (
      <Link
        className="block min-w-0 truncate font-medium text-foreground"
        href={`/platform/organizations/${row.original.slug}`}
      >
        {row.original.name === row.original.slug
          ? row.original.name
          : `${row.original.name} · ${row.original.slug}`}
      </Link>
    ),
  },
  {
    accessorFn: (row) => row.slackIntegration?.teamName ?? "",
    id: "slack",
    header: "Slack",
    cell: ({ row }) => {
      const status = row.original.slackIntegration?.status ?? "disconnected";

      return (
        <InlineStatus
          detail={
            row.original.slackIntegration?.connectedAt
              ? `Connected ${row.original.slackIntegration.connectedAt.toISOString()}`
              : formatStatus(status)
          }
          status={status}
          value={row.original.slackIntegration?.teamName ?? "Not connected"}
        />
      );
    },
  },
  {
    accessorFn: (row) => row.tenant?.name ?? "",
    id: "tenant",
    header: "Tenant",
    cell: ({ row }) => (
      <span className="block min-w-0 truncate text-sm text-foreground">
        {row.original.tenant?.name ?? "Not provisioned"}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.tenant?.ipv4 ?? "",
    id: "server",
    header: "Server",
    cell: ({ row }) => {
      const ipv4 = row.original.tenant?.ipv4;
      const serverStatus = row.original.tenant?.serverStatus ?? null;

      if (!ipv4) {
        return (
          <InlineStatus
            detail={formatStatus(serverStatus)}
            status={serverStatus}
            value="Pending"
          />
        );
      }

      const tone = getStatusTone(serverStatus);

      return (
        <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
          <HoverCard>
            <HoverCardTrigger className="flex shrink-0 items-center">
              <span
                aria-hidden="true"
                className={cn("size-2 rounded-full", tone.dotClassName)}
              />
            </HoverCardTrigger>
            <HoverCardContent
              align="start"
              className="w-auto min-w-32 rounded-2xl px-3 py-2"
            >
              <div className="text-xs font-medium text-foreground">
                {formatStatus(serverStatus)}
              </div>
            </HoverCardContent>
          </HoverCard>
          <CopyableValue value={ipv4} />
        </div>
      );
    },
  },
  {
    accessorKey: "observedRuntimeImageVersion",
    header: "Image",
    cell: ({ row }) => {
      const label =
        row.original.observedRuntimeImageVersion ??
        row.original.observedRuntimeImage ??
        "Not available";
      const href = row.original.observedRuntimeImage
        ? getRuntimeImageHref(row.original.observedRuntimeImage)
        : null;

      if (!href) {
        return (
          <span className="truncate text-sm text-foreground">{label}</span>
        );
      }

      return (
        <Link
          className="truncate text-sm text-foreground"
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          {label}
        </Link>
      );
    },
  },
  {
    accessorFn: (row) =>
      formatIsoTimestamp(getLatestSyncSummary(row).timestamp),
    id: "latestSync",
    header: "Latest sync",
    cell: ({ row }) => {
      const summary = getLatestSyncSummary(row.original);

      return (
        <InlineStatus
          detail={summary.detail}
          status={summary.status}
          value={formatIsoTimestamp(summary.timestamp) ?? "Never"}
        />
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <OrganizationActionsCell organization={row.original} />,
  },
];

export function PlatformOrganizationsTable({
  organizations,
}: PlatformOrganizationsTableProps) {
  return (
    <DataTable
      bodyClassName="align-top"
      cellClassName="h-14 py-3"
      columns={columns}
      data={organizations}
      emptyMessage="No organizations found."
      fillAvailableSpace
      headClassName="h-11 px-4 text-sm font-medium text-foreground"
      headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
      rowClassName="hover:bg-transparent"
      searchKeys={["name", "slug"]}
      searchPlaceholder="Search by workspace name or slug"
      tableClassName="min-w-full table-fixed"
      toolbarClassName="px-4 pb-4 md:px-6"
      viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
    />
  );
}

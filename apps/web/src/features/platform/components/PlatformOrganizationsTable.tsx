import { DotsThreeIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import type { PlatformOrganizationListItem } from "@otto/feature-platform"

import {
  addCurrentUserAsPlatformOrganizationAdmin,
  applyPlatformOrganization,
  deployPlatformRuntime,
  platformBootstrapQueryOptions,
  platformOrganizationsQueryOptions,
  provisionPlatformServer,
  refreshPlatformRuntimeImage,
} from "@/features/platform/api/platform"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

function getStatusTone(status: string | null) {
  switch (status) {
    case "connected":
    case "ready":
    case "succeeded":
      return {
        dotClassName: "bg-emerald-500",
      }
    case "queued":
    case "running":
    case "pending_apply":
    case "provisioning":
      return {
        dotClassName: "bg-amber-500",
      }
    case "failed":
    case "error":
      return {
        dotClassName: "bg-destructive",
      }
    default:
      return {
        dotClassName: "bg-muted-foreground/35",
      }
  }
}

function formatStatus(status: string | null) {
  if (!status) {
    return "Not available"
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatIsoTimestamp(value: string | null | undefined) {
  return value ?? null
}

function getLatestSyncSummary(organization: PlatformOrganizationListItem) {
  if (organization.tenant?.latestApplyRun) {
    return {
      detail:
        organization.tenant.latestApplyRun.error ??
        `Desired state v${organization.tenant.latestApplyRun.desiredStateVersion}`,
      status: organization.tenant.latestApplyRun.status,
      timestamp:
        organization.tenant.latestApplyRun.finishedAt ??
        organization.tenant.latestApplyRun.startedAt,
    }
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
    }
  }

  return {
    detail: "No runtime activity yet",
    status: null,
    timestamp: null,
  }
}

function getRuntimeImageHref(image: string) {
  if (!image.startsWith("ghcr.io/")) {
    return null
  }

  const [repository] = image.replace("ghcr.io/", "").split(":")
  const [owner, packageName] = repository.split("/")

  if (!owner || !packageName) {
    return null
  }

  return `https://github.com/orgs/${owner}/packages/container/package/${packageName}`
}

export interface InlineStatusProps {
  detail?: string | null
  status: string | null
  value: string
}

export function InlineStatus({ detail, status, value }: InlineStatusProps) {
  const tone = getStatusTone(status)

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
  )
}

export interface CopyableValueProps {
  value: string
}

export function CopyableValue({ value }: CopyableValueProps) {
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)

  async function handleClick() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => {
      setCopied(false)
      setHovered(false)
    }, 1500)
  }

  return (
    <Tooltip open={hovered || copied}>
      <TooltipTrigger
        render={
          <button
            aria-label={`Copy ${value}`}
            type="button"
            className="cursor-pointer select-text truncate text-left text-sm text-foreground"
            onBlur={() => setHovered(false)}
            onClick={handleClick}
            onFocus={() => setHovered(true)}
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
          copied && "bg-green-100 text-green-700",
        )}
      >
        {copied ? "Copied" : "Copy"}
      </TooltipContent>
    </Tooltip>
  )
}

type OrganizationAction =
  | "add-current-user-admin"
  | "apply"
  | "deploy-runtime"
  | "provision-server-legacy"
  | "refresh-image"

export interface OrganizationActionsCellProps {
  organization: PlatformOrganizationListItem
}

export function OrganizationActionsCell({
  organization,
}: OrganizationActionsCellProps) {
  const queryClient = useQueryClient()
  const [pendingAction, startTransition] = useTransition()
  const runtimeReady =
    organization.tenant?.status === "ready" &&
    organization.tenant.serverStatus === "ready"
  const canProvisionServer =
    organization.tenant === null || organization.tenant.serverStatus === null

  function runAction(action: OrganizationAction) {
    startTransition(async () => {
      try {
        if (action === "add-current-user-admin") {
          await addCurrentUserAsPlatformOrganizationAdmin(organization.slug)
        } else if (action === "apply") {
          await applyPlatformOrganization(organization.slug)
        } else if (action === "deploy-runtime") {
          await deployPlatformRuntime(organization.slug)
        } else if (action === "provision-server-legacy") {
          await provisionPlatformServer({
            orgSlug: organization.slug,
            payload: {
              provisioningStrategy: "legacy_base_image",
            },
          })
        } else {
          await refreshPlatformRuntimeImage(organization.slug)
        }

        toast.success(
          action === "add-current-user-admin"
            ? "Added you as an admin member."
            : action === "apply"
            ? "Queued runtime apply."
            : action === "deploy-runtime"
              ? "Queued runtime deploy."
              : action === "provision-server-legacy"
                ? "Queued server provisioning from the base image."
                : "Queued runtime image refresh.",
        )
        await queryClient.invalidateQueries({
          queryKey: platformOrganizationsQueryOptions().queryKey,
        })
        await queryClient.invalidateQueries({
          queryKey: platformBootstrapQueryOptions().queryKey,
        })
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Platform action failed.",
        )
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open organization actions"
            className="text-muted-foreground"
            disabled={pendingAction}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <DotsThreeIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={pendingAction}
          onClick={() => runAction("add-current-user-admin")}
        >
          Add me as admin member
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canProvisionServer || pendingAction}
          onClick={() => runAction("provision-server-legacy")}
        >
          Provision server from base image
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!runtimeReady || pendingAction}
          onClick={() => runAction("deploy-runtime")}
        >
          Pull new image and apply config
        </DropdownMenuItem>
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
  )
}

const columns: ColumnDef<PlatformOrganizationListItem>[] = [
  {
    accessorKey: "name",
    header: "Organization",
    cell: ({ row }) => (
      <Link
        className="block min-w-0 truncate font-medium text-foreground"
        params={{ platformOrgSlug: row.original.slug }}
        to="/platform/organizations/$platformOrgSlug/overview"
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
      const status = row.original.slackIntegration?.status ?? "disconnected"

      return (
        <InlineStatus
          detail={
            row.original.slackIntegration?.connectedAt
              ? `Connected ${row.original.slackIntegration.connectedAt}`
              : formatStatus(status)
          }
          status={status}
          value={row.original.slackIntegration?.teamName ?? "Not connected"}
        />
      )
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
      const ipv4 = row.original.tenant?.ipv4
      const serverStatus = row.original.tenant?.serverStatus ?? null

      if (!ipv4) {
        return (
          <InlineStatus
            detail={formatStatus(serverStatus)}
            status={serverStatus}
            value="Pending"
          />
        )
      }

      const tone = getStatusTone(serverStatus)

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
      )
    },
  },
  {
    accessorKey: "observedRuntimeImageVersion",
    header: "Image",
    cell: ({ row }) => {
      const label =
        row.original.observedRuntimeImageVersion ??
        row.original.observedRuntimeImage ??
        "Not available"
      const href = row.original.observedRuntimeImage
        ? getRuntimeImageHref(row.original.observedRuntimeImage)
        : null

      if (!href) {
        return <span className="truncate text-sm text-foreground">{label}</span>
      }

      return (
        <a
          className="truncate text-sm text-foreground"
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          {label}
        </a>
      )
    },
  },
  {
    accessorFn: (row) => formatIsoTimestamp(getLatestSyncSummary(row).timestamp),
    id: "latestSync",
    header: "Latest sync",
    cell: ({ row }) => {
      const summary = getLatestSyncSummary(row.original)

      return (
        <InlineStatus
          detail={summary.detail}
          status={summary.status}
          value={formatIsoTimestamp(summary.timestamp) ?? "Never"}
        />
      )
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <OrganizationActionsCell organization={row.original} />,
  },
]

export interface PlatformOrganizationsTableProps {
  organizations: PlatformOrganizationListItem[]
}

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
  )
}

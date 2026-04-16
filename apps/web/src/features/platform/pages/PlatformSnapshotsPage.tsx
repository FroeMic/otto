import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useEffect, useTransition } from "react"
import { toast } from "sonner"
import type { PlatformSnapshotBake } from "@otto/feature-platform"

import {
  bakePlatformSnapshot,
  platformSnapshotsQueryOptions,
} from "@/features/platform/api/platform"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ACTIVE_SNAPSHOT_STATUSES = new Set(["queued", "running"])

function formatStatus(value: string | null) {
  if (!value) {
    return "Not available"
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getStatusVariant(status: string) {
  switch (status) {
    case "succeeded":
      return "secondary" as const
    case "failed":
      return "destructive" as const
    default:
      return "outline" as const
  }
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not finished"
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function findLatestSuccessfulSnapshot(snapshots: PlatformSnapshotBake[]) {
  return snapshots.find(
    (snapshot) => snapshot.status === "succeeded" && snapshot.snapshotId,
  )
}

function findLatestActiveSnapshot(snapshots: PlatformSnapshotBake[]) {
  return snapshots.find((snapshot) =>
    ACTIVE_SNAPSHOT_STATUSES.has(snapshot.status),
  )
}

function formatCompactValue(value: string | null | undefined) {
  return value && value.length > 0 ? value : "Not available"
}

export interface PlatformSnapshotsPageProps {}

export function PlatformSnapshotsPage(_props: PlatformSnapshotsPageProps) {
  const { data } = useSuspenseQuery(platformSnapshotsQueryOptions())
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const latestSuccessfulSnapshot = findLatestSuccessfulSnapshot(data.snapshots)
  const latestActiveSnapshot = findLatestActiveSnapshot(data.snapshots)
  const latestSnapshot = data.snapshots[0] ?? null

  useEffect(() => {
    if (!latestActiveSnapshot) {
      return
    }

    const intervalId = window.setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: platformSnapshotsQueryOptions().queryKey,
      })
    }, 10_000)

    return () => window.clearInterval(intervalId)
  }, [latestActiveSnapshot, queryClient])

  function handleBakeSnapshot() {
    startTransition(async () => {
      try {
        const result = await bakePlatformSnapshot()
        toast.success("Queued onboarding snapshot bake.", {
          description: `Generation ${result.generation}`,
        })
        await queryClient.invalidateQueries({
          queryKey: platformSnapshotsQueryOptions().queryKey,
        })
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Snapshot bake could not be queued.",
        )
      }
    })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 px-4 pt-6 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Infrastructure
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Onboarding snapshots
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Bake reusable Hetzner snapshots for new workspace servers. This is
            platform-wide infrastructure and does not create or modify any
            organization workspace.
          </p>
        </div>
        <Button disabled={isPending} onClick={handleBakeSnapshot} type="button">
          {isPending ? "Queueing..." : "Bake onboarding snapshot"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Latest successful snapshot</CardDescription>
            <CardTitle className="font-mono text-sm">
              {latestSuccessfulSnapshot?.snapshotId ?? "None yet"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {latestSuccessfulSnapshot
              ? `Generation ${latestSuccessfulSnapshot.generation ?? "unknown"}`
              : "Run the first bake to produce a reusable image."}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Current bake</CardDescription>
            <CardTitle>
              {latestActiveSnapshot
                ? formatStatus(latestActiveSnapshot.step ?? latestActiveSnapshot.status)
                : "Idle"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {latestActiveSnapshot
              ? `Job ${latestActiveSnapshot.id}`
              : "No bake job is currently running."}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Latest runtime image</CardDescription>
            <CardTitle className="truncate text-sm">
              {formatCompactValue(
                latestSuccessfulSnapshot?.runtimeImage ?? latestSnapshot?.runtimeImage,
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Base image:{" "}
            {formatCompactValue(
              latestSuccessfulSnapshot?.baseImage ?? latestSnapshot?.baseImage,
            )}
          </CardContent>
        </Card>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Generation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Snapshot ID</TableHead>
              <TableHead>Runtime image</TableHead>
              <TableHead>Base image</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Finished</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.snapshots.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-10 text-center text-sm text-muted-foreground"
                  colSpan={8}
                >
                  No onboarding snapshots have been baked yet.
                </TableCell>
              </TableRow>
            ) : (
              data.snapshots.map((snapshot) => (
                <TableRow key={snapshot.id}>
                  <TableCell className="font-mono text-xs">
                    {snapshot.generation ?? snapshot.id}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(snapshot.status)}>
                      {formatStatus(snapshot.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatStatus(snapshot.step)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {snapshot.snapshotId ?? "Pending"}
                  </TableCell>
                  <TableCell className="max-w-80 truncate text-xs">
                    {snapshot.runtimeImage ?? "Unknown"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {snapshot.baseImage ?? "Unknown"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatTimestamp(snapshot.startedAt ?? snapshot.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatTimestamp(snapshot.finishedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

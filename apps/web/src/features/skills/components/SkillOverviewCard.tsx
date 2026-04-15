import { useQueryClient } from "@tanstack/react-query"
import { useTransition } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IntegrationFloatingStatusChip } from "@/features/integrations/components/IntegrationFloatingStatusChip"

import {
  resetWorkspaceSkillPackage,
  workspaceSkillDetailQueryOptions,
  workspaceSkillsQueryOptions,
} from "../api/skills"
import {
  formatSkillOriginLabel,
  formatSkillStatusLabel,
  getSkillStatusDescription,
  skillStatusBadgeVariant,
} from "../skill-presentation"
import type { WorkspaceSkillDetail } from "../types"

export interface SkillOverviewCardProps {
  detail: WorkspaceSkillDetail
  orgSlug: string
}

export function SkillOverviewCard({
  detail,
  orgSlug,
}: SkillOverviewCardProps) {
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const resettableFiles = detail.files.filter((file) => file.resettable)

  function handleRestoreDefaults() {
    startTransition(() => {
      void resetWorkspaceSkillPackage({
        expectedVersion: detail.version,
        orgSlug,
        skillKey: detail.skillKey,
      })
        .then(async (result) => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: workspaceSkillsQueryOptions(orgSlug).queryKey,
            }),
            queryClient.invalidateQueries({
              queryKey: workspaceSkillDetailQueryOptions({
                orgSlug,
                skillKey: detail.skillKey,
              }).queryKey,
            }),
          ])

          toast.success("Restore defaults queued", {
            description:
              result.resetScope === "companion_files"
                ? "Default companion files will be restored for this skill."
                : "Default skill files will be restored.",
          })
        })
        .catch((error) => {
          toast.error("Defaults could not be restored", {
            description:
              error instanceof Error ? error.message : "Unknown error",
          })
        })
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {isPending ? <IntegrationFloatingStatusChip message="Applying Changes" /> : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {detail.displayName}
          </h1>
          <Badge variant={skillStatusBadgeVariant[detail.status]}>
            {formatSkillStatusLabel(detail.status)}
          </Badge>
          <Badge variant="secondary">{formatSkillOriginLabel(detail.origin)}</Badge>
        </div>
        <p className="max-w-4xl text-sm text-muted-foreground">
          {detail.description}
        </p>
      </div>

      <Alert>
        <AlertTitle>Current status</AlertTitle>
        <AlertDescription>{getSkillStatusDescription(detail.status)}</AlertDescription>
      </Alert>

      {detail.summary ? (
        <Alert>
          <AlertTitle>Recent summary</AlertTitle>
          <AlertDescription>{detail.summary}</AlertDescription>
        </Alert>
      ) : null}

      <Alert>
        <AlertTitle>Dependencies</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>
            Integrations:{" "}
            {detail.dependencies.integrations.length > 0
              ? detail.dependencies.integrations.join(", ")
              : "None"}
          </span>
          <span>
            Skills:{" "}
            {detail.dependencies.skills.length > 0
              ? detail.dependencies.skills.join(", ")
              : "None"}
          </span>
        </AlertDescription>
      </Alert>

      {resettableFiles.length > 0 ? (
        <Alert>
          <AlertTitle>Restore defaults</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              Restore the default companion files for this library-backed skill.
              Current local edits to those files will be replaced.
            </span>
            <div>
              <Button disabled={isPending} onClick={handleRestoreDefaults} type="button" variant="outline">
                Restore defaults
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

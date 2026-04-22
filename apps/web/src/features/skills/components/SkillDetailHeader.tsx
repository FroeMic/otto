import {
  ArrowsClockwiseIcon,
  DotsThreeIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { IntegrationFloatingStatusChip } from "@/features/integrations/components/IntegrationFloatingStatusChip"

import {
  installWorkspaceLibrarySkill,
  removeWorkspaceSkill,
  resetWorkspaceSkillPackage,
  workspaceSkillDetailQueryOptions,
  workspaceSkillLibraryDetailQueryOptions,
  workspaceSkillsQueryOptions,
} from "../api/skills"
import { formatSkillOriginLabel } from "../skill-presentation"
import type {
  WorkspaceSkillDetail,
  WorkspaceSkillLibraryDetail,
} from "../types"

export type SkillDetailHeaderProps =
  | {
      detail: WorkspaceSkillDetail
      mode: "installed"
      orgSlug: string
    }
  | {
      detail: WorkspaceSkillLibraryDetail
      mode: "library"
      orgSlug: string
    }

export function SkillDetailHeader({
  detail,
  mode,
  orgSlug,
}: SkillDetailHeaderProps) {
  const isInstalledDetail = mode === "installed" && "version" in detail
  const isReadOnly =
    mode === "library" || (isInstalledDetail && !detail.editable)
  const originLabel =
    mode === "library" ? "From library" : formatSkillOriginLabel(detail.origin)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {detail.displayName}
            </h1>
            {isReadOnly ? <ReadOnlyBadge /> : null}
            <Badge variant="secondary">{originLabel}</Badge>
          </div>
          <p className="max-w-4xl text-sm text-muted-foreground">
            {detail.description}
          </p>
        </div>

        {mode === "library" && !detail.installed ? (
          <InstallLibrarySkillButton detail={detail} orgSlug={orgSlug} />
        ) : null}
        {isInstalledDetail ? (
          <InstalledSkillActions detail={detail} orgSlug={orgSlug} />
        ) : null}
      </div>
    </div>
  )
}

function ReadOnlyBadge() {
  return (
    <HoverCard>
      <HoverCardTrigger>
        <Badge className="cursor-help" variant="outline">
          Read only
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent className="text-sm" side="top">
        Library-backed skills can be inspected here. Custom skills can be edited
        directly in the workspace.
      </HoverCardContent>
    </HoverCard>
  )
}

interface InstallLibrarySkillButtonProps {
  detail: WorkspaceSkillLibraryDetail
  orgSlug: string
}

function InstallLibrarySkillButton({
  detail,
  orgSlug,
}: InstallLibrarySkillButtonProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()

  function handleInstall() {
    startTransition(() => {
      void installWorkspaceLibrarySkill({
        orgSlug,
        skillKey: detail.skillKey,
      })
        .then(async (result) => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: workspaceSkillsQueryOptions(orgSlug).queryKey,
            }),
            queryClient.invalidateQueries({
              queryKey: workspaceSkillLibraryDetailQueryOptions({
                orgSlug,
                skillKey: detail.skillKey,
              }).queryKey,
            }),
          ])

          void navigate({
            params: {
              orgSlug,
              skillKey: result.skillKey,
            },
            to: "/$orgSlug/skills/$skillKey/overview",
          })
        })
        .catch((error) => {
          toast.error("Skill could not be installed", {
            description:
              error instanceof Error ? error.message : "Unknown error",
          })
        })
    })
  }

  return (
    <Button
      className="shrink-0"
      disabled={!detail.installable || isPending}
      onClick={handleInstall}
      type="button"
    >
      {isPending ? "Installing…" : "Install Skill"}
    </Button>
  )
}

interface InstalledSkillActionsProps {
  detail: WorkspaceSkillDetail
  orgSlug: string
}

function InstalledSkillActions({
  detail,
  orgSlug,
}: InstalledSkillActionsProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const resettableFiles = detail.files.filter((file) => file.resettable)
  const hasActions = detail.removable || resettableFiles.length > 0

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

  function handleRemoveSkill() {
    startTransition(() => {
      void removeWorkspaceSkill({
        expectedVersion: detail.version,
        orgSlug,
        skillKey: detail.skillKey,
      })
        .then(async () => {
          await queryClient.invalidateQueries({
            queryKey: workspaceSkillsQueryOptions(orgSlug).queryKey,
          })
          setIsRemoveDialogOpen(false)

          void navigate({
            params: {
              orgSlug,
            },
            to: "/$orgSlug/skills/installed",
          })
        })
        .catch((error) => {
          toast.error("Skill could not be removed", {
            description:
              error instanceof Error ? error.message : "Unknown error",
          })
        })
    })
  }

  if (!hasActions) {
    return null
  }

  return (
    <>
      {isPending ? (
        <IntegrationFloatingStatusChip message="Applying Changes" />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Skill actions"
              className="shrink-0"
              disabled={isPending}
              size="icon-sm"
              variant="outline"
            />
          }
        >
          <DotsThreeIcon weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {resettableFiles.length > 0 ? (
            <DropdownMenuItem
              disabled={isPending}
              onClick={handleRestoreDefaults}
            >
              <ArrowsClockwiseIcon className="size-4" />
              Restore Defaults
            </DropdownMenuItem>
          ) : null}
          {detail.removable && resettableFiles.length > 0 ? (
            <DropdownMenuSeparator />
          ) : null}
          {detail.removable ? (
            <DropdownMenuItem
              disabled={isPending}
              onClick={() => setIsRemoveDialogOpen(true)}
              variant="destructive"
            >
              <TrashIcon className="size-4" />
              Uninstall Skill
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        onOpenChange={setIsRemoveDialogOpen}
        open={isRemoveDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uninstall this skill?</AlertDialogTitle>
            <AlertDialogDescription>
              Uninstalling {detail.displayName} will remove it from this
              workspace and delete its skill data, including included files and
              workspace-local files for this skill.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={handleRemoveSkill}
              variant="destructive"
            >
              Uninstall Skill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

import type { ColumnDef } from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useMemo, useState, useTransition } from "react"

import {
  deriveSlackPolicyEffects,
  isSlackPolicyDestructive,
  type SlackPolicyDerivedEffects,
} from "@otto/feature-integrations-runtime/integrations/library/slack/policy"

import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  disconnectWorkspaceIntegration,
  updateWorkspaceSlackChannelMembership,
  updateWorkspaceSlackSettings,
} from "@/features/integrations/api/integrations"
import { IntegrationCapabilitiesTable } from "@/features/integrations/components/IntegrationCapabilitiesTable"
import { IntegrationSettingsShell } from "@/features/integrations/components/IntegrationSettingsShell"
import { IntegrationStickySaveBar } from "@/features/integrations/components/IntegrationStickySaveBar"
import type { WorkspaceIntegrationDetail } from "@/features/integrations/types"

import { SlackActionsMenu } from "../components/SlackActionsMenu"

export interface SlackIntegrationStatusPageProps {
  currentSection: string
  detail: WorkspaceIntegrationDetail
  onSectionChange: (section: string) => void
  orgSlug: string
}

interface SlackDirectoryOption {
  description: string | null
  id: string
  isArchived?: boolean
  isMember?: boolean
  label: string
  secondaryLabel: string | null
  visibility?: "private" | "public" | null
}

interface SlackRuntimeConfig {
  ackReactionEnabled: boolean
  allowedChannelIds: string[]
  allowedUserIds: string[]
  answerInThreads: boolean
  channelAccessMode: "manual_allowlist" | "member_of_channels"
  enabled: boolean
  entryVersion: number
  installState: "installed" | "uninstalled"
  requireMentionInChannels: boolean
  schemaVersion: string
}

interface SlackRuntimeConfigSurface {
  availableChannels: SlackDirectoryOption[]
  availableUsers: SlackDirectoryOption[]
  config: SlackRuntimeConfig
}

interface SelectedDirectoryEntry extends SlackDirectoryOption {
  isMissing?: boolean
}

interface SlackPersonRow extends SlackDirectoryOption {
  isSelected: boolean
  searchText: string
}

interface SlackChannelRow extends SlackDirectoryOption {
  isSelected: boolean
  replyAccessLabel: string
  replyAccessVariant: "default" | "destructive" | "outline" | "secondary"
  searchText: string
}

const EMPTY_DRAFT_EFFECTS: SlackPolicyDerivedEffects = {
  channelRepliesEnabled: false,
  dmEnabled: false,
  effectiveChannelCount: 0,
  effectiveChannelIds: [],
  warnings: [],
  wouldDisableChannelReplies: false,
  wouldDisableDMs: false,
  wouldFullyLockOutSlack: false,
}

function getInitials(label: string) {
  const parts = label
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return "SL"
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

function normalizeIds(ids: string[]) {
  return [...ids].sort()
}

function formatChannelLabel(label: string) {
  return label.startsWith("#") ? label : `#${label}`
}

function getChannelAccessModeLabel(
  value: "manual_allowlist" | "member_of_channels" | null | undefined,
) {
  if (value === "member_of_channels") {
    return "Any channel where Otto has been added"
  }

  return "Only selected channels"
}

function areConfigsEqual(left: SlackRuntimeConfig, right: SlackRuntimeConfig) {
  return (
    JSON.stringify({
      ...left,
      allowedChannelIds: normalizeIds(left.allowedChannelIds),
      allowedUserIds: normalizeIds(left.allowedUserIds),
    }) ===
    JSON.stringify({
      ...right,
      allowedChannelIds: normalizeIds(right.allowedChannelIds),
      allowedUserIds: normalizeIds(right.allowedUserIds),
    })
  )
}

function getSelectedDirectoryEntries(
  availableOptions: SlackDirectoryOption[],
  selectedIds: string[],
): SelectedDirectoryEntry[] {
  const optionMap = new Map(
    availableOptions.map((option) => [option.id, option]),
  )

  return selectedIds.map((id) => {
    const option = optionMap.get(id)

    return option
      ? option
      : {
          description:
            "This saved selection is not present in the latest Slack sync.",
          id,
          isMissing: true,
          label: id,
          secondaryLabel: "Unavailable in current Slack sync",
        }
  })
}

function getJoinedChannelEntries(
  availableOptions: SlackDirectoryOption[],
): SelectedDirectoryEntry[] {
  return availableOptions.filter((option) => option.isMember)
}

function getChannelMembershipAction(option: SlackDirectoryOption) {
  if (option.isArchived) {
    return {
      action: null,
      disabled: true,
      label: "Archived",
    } as const
  }

  if (option.isMember) {
    return {
      action: "leave",
      disabled: false,
      label: "Remove Otto",
    } as const
  }

  if (option.visibility === "private") {
    return {
      action: null,
      disabled: true,
      label: "Invite in Slack",
    } as const
  }

  return {
    action: "join",
    disabled: false,
    label: "Add Otto",
  } as const
}

function getChannelReplyAccess(input: {
  channel: SlackDirectoryOption
  channelAccessMode: "manual_allowlist" | "member_of_channels"
  selectedIds: string[]
}) {
  const isSelected = input.selectedIds.includes(input.channel.id)
  const isMember = Boolean(input.channel.isMember)

  if (input.channelAccessMode === "member_of_channels") {
    return isMember
      ? {
          label: "Can reply",
          variant: "secondary" as const,
        }
      : {
          label: "Not added yet",
          variant: "outline" as const,
        }
  }

  if (isSelected && isMember) {
    return {
      label: "Can reply",
      variant: "secondary" as const,
    }
  }

  if (isSelected && !isMember) {
    return {
      label: "Selected, add Otto",
      variant: "outline" as const,
    }
  }

  if (!isSelected && isMember) {
    return {
      label: "Added, not selected",
      variant: "outline" as const,
    }
  }

  return {
    label: "Not allowed",
    variant: "outline" as const,
  }
}

function DirectoryIdentity(props: {
  kind: "channel" | "user"
  option: SelectedDirectoryEntry
}) {
  const { kind, option } = props
  const secondaryText = option.secondaryLabel ?? option.description

  return (
    <div className="flex min-w-0 items-start gap-3">
      {kind === "user" ? (
        <Avatar className="size-8">
          <AvatarFallback>{getInitials(option.label)}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-medium text-muted-foreground">
          #
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {kind === "channel" ? formatChannelLabel(option.label) : option.label}
          </p>
          {option.isMissing ? <Badge variant="outline">Unavailable</Badge> : null}
        </div>
        {secondaryText ? (
          <p className="truncate text-xs text-muted-foreground">
            {secondaryText}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SummaryValue(props: {
  action?: ReactNode
  text: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-sm text-muted-foreground">{props.text}</span>
      {props.action}
    </div>
  )
}

function getSlackSurface(detail: WorkspaceIntegrationDetail) {
  const surface = detail.settings?.surface

  if (
    !surface ||
    !Array.isArray(surface.availableChannels) ||
    !Array.isArray(surface.availableUsers) ||
    !surface.config ||
    typeof surface.config !== "object"
  ) {
    return null
  }

  return {
    availableChannels: surface.availableChannels as SlackDirectoryOption[],
    availableUsers: surface.availableUsers as SlackDirectoryOption[],
    config: surface.config as unknown as SlackRuntimeConfig,
  } satisfies SlackRuntimeConfigSurface
}

function getStatusAlert(detail: WorkspaceIntegrationDetail) {
  if (detail.summary?.lastError) {
    return {
      description: detail.summary.lastError,
      title: "Slack could not be connected",
      variant: "destructive" as const,
    }
  }

  if (!detail.connection.status.connected) {
    return {
      description:
        "Connect Slack so your team can ask Otto for help where conversations already happen.",
      title: "Slack is not connected yet",
      variant: "default" as const,
    }
  }

  return null
}

function getStatusBadgeVariant(detail: WorkspaceIntegrationDetail) {
  if (detail.summary?.lastError) {
    return "destructive" as const
  }

  if (detail.connection.status.connected) {
    return "outline" as const
  }

  return "secondary" as const
}

function getSlackStatusLabel(detail: WorkspaceIntegrationDetail) {
  if (detail.summary?.lastError) {
    return "Needs attention"
  }

  return detail.connection.status.connected ? "Connected" : "Not connected"
}

export function SlackIntegrationStatusPage({
  currentSection,
  detail,
  onSectionChange,
  orgSlug,
}: SlackIntegrationStatusPageProps) {
  const queryClient = useQueryClient()
  const initialSurface = getSlackSurface(detail)
  const [surface, setSurface] = useState<SlackRuntimeConfigSurface | null>(
    initialSurface,
  )
  const [draft, setDraft] = useState<SlackRuntimeConfig | null>(
    initialSurface?.config ?? null,
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [pendingMembershipAction, setPendingMembershipAction] = useState<{
    action: "join" | "leave"
    channelId: string
  } | null>(null)
  const [isDangerDialogOpen, setIsDangerDialogOpen] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isPending, startTransition] = useTransition()

  const hasChanges =
    surface && draft ? !areConfigsEqual(draft, surface.config) : false
  const draftEffects = useMemo(
    () =>
      surface && draft
        ? deriveSlackPolicyEffects({
            config: draft,
            currentConfig: surface.config,
            directoryChannels: surface.availableChannels.map((channel) => ({
              id: channel.id,
              isArchived: channel.isArchived,
              isMember: channel.isMember,
            })),
          })
        : EMPTY_DRAFT_EFFECTS,
    [draft, surface],
  )
  const requiresDestructiveConfirmation = draft
    ? isSlackPolicyDestructive(draftEffects)
    : false
  const selectedUsers = useMemo(
    () =>
      surface && draft
        ? getSelectedDirectoryEntries(surface.availableUsers, draft.allowedUserIds)
        : [],
    [draft, surface],
  )
  const selectedChannels = useMemo(() => {
    if (!surface || !draft) {
      return []
    }

    if (draft.channelAccessMode === "member_of_channels") {
      return getJoinedChannelEntries(surface.availableChannels)
    }

    return getSelectedDirectoryEntries(
      surface.availableChannels,
      draft.allowedChannelIds,
    )
  }, [draft, surface])
  const missingSelectedUsers = selectedUsers.filter((entry) => entry.isMissing)
  const missingSelectedChannels = selectedChannels.filter((entry) => entry.isMissing)
  const selectedPeopleCount = draft?.allowedUserIds.length ?? 0
  const selectedChannelCount =
    draft?.channelAccessMode === "member_of_channels"
      ? selectedChannels.length
      : (draft?.allowedChannelIds.length ?? 0)

  const peopleRows = useMemo<SlackPersonRow[]>(() => {
    if (!surface || !draft) {
      return []
    }

    return surface.availableUsers.map((user) => ({
      ...user,
      isSelected: draft.allowedUserIds.includes(user.id),
      searchText: [user.label, user.secondaryLabel, user.description, user.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    }))
  }, [draft, surface])

  const channelRows = useMemo<SlackChannelRow[]>(() => {
    if (!surface || !draft) {
      return []
    }

    return surface.availableChannels.map((channel) => {
      const replyAccess = getChannelReplyAccess({
        channel,
        channelAccessMode: draft.channelAccessMode,
        selectedIds: draft.allowedChannelIds,
      })

      return {
        ...channel,
        isSelected: draft.allowedChannelIds.includes(channel.id),
        replyAccessLabel: replyAccess.label,
        replyAccessVariant: replyAccess.variant,
        searchText: [
          channel.label,
          channel.secondaryLabel,
          channel.description,
          channel.visibility,
          channel.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      }
    })
  }, [draft, surface])

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ["workspace-integrations", orgSlug],
    })
    void queryClient.invalidateQueries({
      queryKey: ["workspace-integration-detail", orgSlug, detail.integration.key],
    })
  }

  function resetDraft() {
    if (!surface) {
      return
    }

    setDraft(surface.config)
    setErrorMessage(null)
    setIsDangerDialogOpen(false)
    setMembershipError(null)
  }

  function updateBooleanSetting(
    key: "ackReactionEnabled" | "answerInThreads" | "requireMentionInChannels",
    value: boolean,
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
    )
  }

  function updateChannelAccessMode(value: "manual_allowlist" | "member_of_channels") {
    setDraft((current) =>
      current
        ? {
            ...current,
            channelAccessMode: value,
          }
        : current,
    )
  }

  function toggleAllowedUser(userId: string) {
    setDraft((current) => {
      if (!current) {
        return current
      }

      const nextIds = current.allowedUserIds.includes(userId)
        ? current.allowedUserIds.filter((id) => id !== userId)
        : [...current.allowedUserIds, userId]

      return {
        ...current,
        allowedUserIds: nextIds,
      }
    })
  }

  function toggleAllowedChannel(channelId: string) {
    setDraft((current) => {
      if (!current) {
        return current
      }

      const nextIds = current.allowedChannelIds.includes(channelId)
        ? current.allowedChannelIds.filter((id) => id !== channelId)
        : [...current.allowedChannelIds, channelId]

      return {
        ...current,
        allowedChannelIds: nextIds,
      }
    })
  }

  function handleDisconnect() {
    if (
      !window.confirm(
        "Disconnect Slack from this workspace? Otto will stop using it until you reconnect.",
      )
    ) {
      return
    }

    startTransition(() => {
      void disconnectWorkspaceIntegration({
        integrationKey: detail.integration.key,
        orgSlug,
      })
        .then(() => {
          invalidate()
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error ? error.message : "Slack disconnect failed.",
          )
        })
    })
  }

  function saveDraft() {
    if (!surface || !draft) {
      return
    }

    if (requiresDestructiveConfirmation) {
      setIsDangerDialogOpen(true)
      return
    }

    submitDraft()
  }

  function submitDraft(options?: { allowDestructiveChanges?: boolean }) {
    if (!surface || !draft) {
      return
    }

    startTransition(() => {
      void updateWorkspaceSlackSettings({
        allowDestructiveChanges: options?.allowDestructiveChanges,
        expectedEntryVersion: surface.config.entryVersion,
        orgSlug,
        patch: {
          ackReactionEnabled: draft.ackReactionEnabled,
          allowedChannelIds: draft.allowedChannelIds,
          allowedUserIds: draft.allowedUserIds,
          answerInThreads: draft.answerInThreads,
          channelAccessMode: draft.channelAccessMode,
          requireMentionInChannels: draft.requireMentionInChannels,
        },
        summary: "Updated Slack runtime config",
      })
        .then((result) => {
          const nextSurface = {
            availableChannels: surface.availableChannels,
            availableUsers: surface.availableUsers,
            config: result.surface.config as unknown as SlackRuntimeConfig,
          }

          setErrorMessage(null)
          setIsDangerDialogOpen(false)
          setIsSavingSettings(false)
          setSurface(nextSurface)
          setDraft(nextSurface.config)
          invalidate()
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Slack settings could not be saved.",
          )
          setIsSavingSettings(false)
        })
    })
    setIsSavingSettings(true)
  }

  function changeChannelMembership(channelId: string, action: "join" | "leave") {
    setMembershipError(null)
    setPendingMembershipAction({
      action,
      channelId,
    })

    startTransition(() => {
      void updateWorkspaceSlackChannelMembership({
        action,
        channelId,
        orgSlug,
      })
        .then((result) => {
          if (!surface || !draft) {
            return
          }

          const nextSurface = {
            availableChannels: result.surface.availableChannels as SlackDirectoryOption[],
            availableUsers: surface.availableUsers,
            config: surface.config,
          }

          setSurface(nextSurface)
          setDraft((current) =>
            current
              ? {
                  ...current,
                }
              : current,
          )
          invalidate()
        })
        .catch((error) => {
          setMembershipError(
            error instanceof Error
              ? error.message
              : "Slack channel membership could not be updated.",
          )
        })
        .finally(() => {
          setPendingMembershipAction(null)
        })
    })
  }

  const peopleColumns: Array<ColumnDef<SlackPersonRow>> = [
    {
      accessorKey: "label",
      cell: ({ row }) => <DirectoryIdentity kind="user" option={row.original} />,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Person" />
      ),
      size: 280,
    },
    {
      accessorKey: "secondaryLabel",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.secondaryLabel ?? "Not available"}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Slack name" />
      ),
      size: 200,
    },
    {
      accessorFn: (row) => (row.isSelected ? "selected" : "not-selected"),
      cell: ({ row }) => (
        <Badge variant={row.original.isSelected ? "secondary" : "outline"}>
          {row.original.isSelected ? "Selected" : "Not selected"}
        </Badge>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Selected" />
      ),
      id: "selected",
      size: 120,
    },
    {
      cell: ({ row }) => (
        <Button
          onClick={() => toggleAllowedUser(row.original.id)}
          size="sm"
          type="button"
          variant={row.original.isSelected ? "outline" : "default"}
        >
          {row.original.isSelected ? "Remove" : "Allow"}
        </Button>
      ),
      header: "",
      id: "actions",
      size: 140,
    },
  ]

  const channelColumns: Array<ColumnDef<SlackChannelRow>> = [
    {
      accessorKey: "label",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-medium text-muted-foreground">
            #
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {formatChannelLabel(row.original.label)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.secondaryLabel ??
                row.original.description ??
                row.original.id}
            </p>
          </div>
        </div>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Channel" />
      ),
      size: 280,
    },
    {
      accessorFn: (row) =>
        `${row.visibility ?? "unknown"}:${row.isArchived ? "archived" : "active"}`,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {row.original.visibility === "private" ? "Private" : "Public"}
          </Badge>
          <Badge variant="outline">
            {row.original.isArchived ? "Archived" : "Active"}
          </Badge>
        </div>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      id: "type",
      size: 180,
    },
    {
      accessorFn: (row) => (row.isSelected ? "selected" : "not-selected"),
      cell: ({ row }) => (
        <Badge variant={row.original.isSelected ? "secondary" : "outline"}>
          {row.original.isSelected ? "Selected" : "Not selected"}
        </Badge>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Selected" />
      ),
      id: "selected",
      size: 140,
    },
    {
      accessorFn: (row) => (row.isMember ? "added" : "not-added"),
      cell: ({ row }) => (
        <Badge variant={row.original.isMember ? "secondary" : "outline"}>
          {row.original.isMember ? "Yes" : "No"}
        </Badge>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Otto added" />
      ),
      id: "otto",
      size: 140,
    },
    {
      accessorFn: (row) => row.replyAccessLabel,
      cell: ({ row }) => (
        <Badge variant={row.original.replyAccessVariant}>
          {row.original.replyAccessLabel}
        </Badge>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reply access" />
      ),
      id: "replyAccess",
      size: 170,
    },
    {
      cell: ({ row }) => {
        const membershipAction = getChannelMembershipAction(row.original)
        const isMembershipPending =
          pendingMembershipAction?.channelId === row.original.id

        return (
          <div className="flex flex-wrap justify-end gap-2">
            {draft?.channelAccessMode === "manual_allowlist" ? (
              <Button
                onClick={() => toggleAllowedChannel(row.original.id)}
                size="sm"
                type="button"
                variant={row.original.isSelected ? "outline" : "default"}
              >
                {row.original.isSelected ? "Remove" : "Allow"}
              </Button>
            ) : null}
            <Button
              disabled={membershipAction.disabled || pendingMembershipAction !== null}
              onClick={() => {
                if (!membershipAction.action) {
                  return
                }

                changeChannelMembership(row.original.id, membershipAction.action)
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {isMembershipPending
                ? pendingMembershipAction?.action === "join"
                  ? "Adding..."
                  : "Removing..."
                : membershipAction.label}
            </Button>
          </div>
        )
      },
      header: "",
      id: "actions",
      size: 260,
    },
  ]

  const statusAlert = getStatusAlert(detail)
  const connectActionLabel = detail.connection.status.connected
    ? "Reconnect Slack"
    : "Connect Slack"

  return (
    <div className="flex flex-col gap-6 pb-24">
      {isSavingSettings ? (
        <div className="fixed bottom-10 right-6 z-30 rounded-full border bg-background px-4 py-2 text-sm shadow-sm">
          Saving Slack settings
        </div>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Slack settings could not be saved</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <section className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex max-w-3xl flex-col gap-2">
            <div className="flex items-center gap-3">
              <img alt="" className="size-8" src={detail.integration.iconSrc ?? ""} />
              <h1 className="text-3xl font-semibold tracking-tight">
                {detail.integration.label}
              </h1>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {detail.integration.pageDescription}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {!detail.connection.status.connected && detail.connection.connectUrl ? (
              <a
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                href={detail.connection.connectUrl}
              >
                {connectActionLabel}
              </a>
            ) : null}
            {detail.connection.status.connected ? (
              <SlackActionsMenu
                canReconnect={Boolean(detail.connection.connectUrl)}
                orgSlug={orgSlug}
                reconnectUrl={detail.connection.connectUrl}
              />
            ) : null}
            <Badge variant={getStatusBadgeVariant(detail)}>
              {getSlackStatusLabel(detail)}
            </Badge>
          </div>
        </div>
      </section>

      {draftEffects.warnings.length > 0 && currentSection !== "capabilities" ? (
        <Alert variant={draftEffects.wouldFullyLockOutSlack ? "destructive" : "default"}>
          <AlertTitle>These changes will limit who can contact Otto</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-2">
              {draftEffects.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <IntegrationSettingsShell
        capabilities={
          <div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col">
            <IntegrationCapabilitiesTable
              integrationKey={detail.integration.key}
              onUpdated={invalidate}
              orgSlug={orgSlug}
              rows={detail.capabilities}
            />
          </div>
        }
        channels={
          <div className="flex flex-col gap-6">
            {membershipError ? (
              <Alert variant="destructive">
                <AlertTitle>Channel membership could not be updated</AlertTitle>
                <AlertDescription>{membershipError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Channel policy:</span>{" "}
                {draft?.channelAccessMode === "member_of_channels"
                  ? "Otto can be added to any channel. Only authorized users can chat with Otto."
                  : "Otto will reply only in selected channels where Otto has been added."}
              </p>
              <DataTable
                bodyClassName="align-middle"
                cellClassName="h-16 px-4 py-3 md:px-6"
                columns={channelColumns}
                data={channelRows}
                emptyMessage="No Slack channels found."
                headClassName="h-11 px-4 text-sm font-medium text-foreground md:px-6"
                headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
                rowClassName="hover:bg-transparent"
                searchKeys={["searchText"]}
                searchPlaceholder="Search channels"
                tableClassName="min-w-full table-fixed"
                viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
              />
            </div>
          </div>
        }
        configuration={
          <SettingsPage className="mx-0 max-w-3xl">
            <div className="flex flex-col gap-8">
              <SettingsSection>
                <SettingsSectionTitle>Replies</SettingsSectionTitle>
                <SettingsSectionDescription>
                  Choose how Otto behaves once a Slack message is allowed through.
                </SettingsSectionDescription>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Acknowledgement reaction</SettingsRowTitle>
                      <SettingsRowDescription>
                        Add Otto&apos;s standard reaction while it is preparing a reply.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Switch
                      checked={draft?.ackReactionEnabled ?? false}
                      onCheckedChange={(checked) =>
                        updateBooleanSetting("ackReactionEnabled", checked)
                      }
                    />
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Reply in threads</SettingsRowTitle>
                      <SettingsRowDescription>
                        Keep channel replies inside the original Slack thread.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Switch
                      checked={draft?.answerInThreads ?? false}
                      onCheckedChange={(checked) =>
                        updateBooleanSetting("answerInThreads", checked)
                      }
                    />
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Require @mention in channels</SettingsRowTitle>
                      <SettingsRowDescription>
                        When this is on, Otto only replies in channels after an explicit mention.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Switch
                      checked={draft?.requireMentionInChannels ?? false}
                      onCheckedChange={(checked) =>
                        updateBooleanSetting("requireMentionInChannels", checked)
                      }
                    />
                  </SettingsRow>
                </SettingsCard>
              </SettingsSection>

              <SettingsSection>
                <SettingsSectionTitle>Access</SettingsSectionTitle>
                <SettingsSectionDescription>
                  Choose who can use Otto in Slack and where Otto can reply.
                </SettingsSectionDescription>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>People who can message Otto</SettingsRowTitle>
                      <SettingsRowDescription>
                        {missingSelectedUsers.length > 0
                          ? `${missingSelectedUsers.length} saved selection${missingSelectedUsers.length === 1 ? "" : "s"} are missing from the latest Slack sync.`
                          : "Choose the people who can start Slack conversations with Otto."}
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <SummaryValue
                      action={
                        <Button
                          onClick={() => onSectionChange("people")}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Manage
                        </Button>
                      }
                      text={
                        selectedPeopleCount === 0
                          ? "No one selected"
                          : `${selectedPeopleCount} selected`
                      }
                    />
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Where Otto can reply</SettingsRowTitle>
                      <SettingsRowDescription>
                        {draft?.channelAccessMode === "member_of_channels"
                          ? "Any channel where Otto has been added becomes active right away."
                          : "Otto only replies in channels that are selected here and already include Otto."}
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Select
                      value={draft?.channelAccessMode ?? "manual_allowlist"}
                      onValueChange={(value) => {
                        if (
                          value === "manual_allowlist" ||
                          value === "member_of_channels"
                        ) {
                          updateChannelAccessMode(value)
                        }
                      }}
                    >
                      <SelectTrigger className="w-[18rem]">
                        <SelectValue>
                          {(value) =>
                            getChannelAccessModeLabel(
                              value as
                                | "manual_allowlist"
                                | "member_of_channels"
                                | null
                                | undefined,
                            )
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="manual_allowlist">
                          Only selected channels
                        </SelectItem>
                        <SelectItem value="member_of_channels">
                          Any channel where Otto has been added
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>
                        {draft?.channelAccessMode === "member_of_channels"
                          ? "Channels where Otto is active"
                          : "Selected channels"}
                      </SettingsRowTitle>
                      <SettingsRowDescription>
                        {draft?.channelAccessMode === "member_of_channels"
                          ? "Otto can reply in every channel listed as added."
                          : missingSelectedChannels.length > 0
                            ? `${missingSelectedChannels.length} saved selection${missingSelectedChannels.length === 1 ? "" : "s"} are missing from the latest Slack sync.`
                            : "Review selected channels and add Otto where needed."}
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <SummaryValue
                      action={
                        <Button
                          onClick={() => onSectionChange("channels")}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Manage
                        </Button>
                      }
                      text={
                        selectedChannelCount === 0
                          ? "No channels selected"
                          : `${selectedChannelCount} channel${selectedChannelCount === 1 ? "" : "s"}`
                      }
                    />
                  </SettingsRow>
                </SettingsCard>
              </SettingsSection>
            </div>
          </SettingsPage>
        }
        currentSection={currentSection}
        onSectionChange={onSectionChange}
        people={
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Access policy:</span>{" "}
                Otto will reply only to selected users.
              </p>
              <DataTable
                bodyClassName="align-middle"
                cellClassName="h-16 px-4 py-3 md:px-6"
                columns={peopleColumns}
                data={peopleRows}
                emptyMessage="No Slack people found."
                headClassName="h-11 px-4 text-sm font-medium text-foreground md:px-6"
                headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
                rowClassName="hover:bg-transparent"
                searchKeys={["searchText"]}
                searchPlaceholder="Search people"
                tableClassName="min-w-full table-fixed"
                viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
              />
            </div>
          </div>
        }
        status={
          <SettingsPage className="mx-0 max-w-3xl">
            <div className="flex flex-col gap-8">
              {statusAlert ? (
                <Alert variant={statusAlert.variant}>
                  <AlertTitle>{statusAlert.title}</AlertTitle>
                  <AlertDescription>{statusAlert.description}</AlertDescription>
                </Alert>
              ) : null}

              <SettingsSection>
                <SettingsSectionTitle>Connection</SettingsSectionTitle>
                <SettingsSectionDescription>
                  Current Slack connection details for this workspace.
                </SettingsSectionDescription>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Status</SettingsRowTitle>
                      <SettingsRowDescription>
                        Otto can only reply in Slack after the connection is healthy.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Badge variant={getStatusBadgeVariant(detail)}>
                      {getSlackStatusLabel(detail)}
                    </Badge>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Workspace</SettingsRowTitle>
                      <SettingsRowDescription>
                        The current workspace where this integration belongs.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">{orgSlug}</span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Connected on</SettingsRowTitle>
                      <SettingsRowDescription>
                        The most recent successful connection time.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {detail.summary?.connectedAt ?? "Not available"}
                    </span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Last update</SettingsRowTitle>
                      <SettingsRowDescription>
                        The latest update recorded for this Slack connection.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {detail.summary?.lastErrorAt ?? "No recent update"}
                    </span>
                  </SettingsRow>
                </SettingsCard>
              </SettingsSection>

              <SettingsSection>
                <SettingsSectionTitle>Actions</SettingsSectionTitle>
                <SettingsSectionDescription>
                  Connect, reconnect, or disconnect Slack for this workspace.
                </SettingsSectionDescription>
                <SettingsCard>
                  {detail.connection.connectUrl ? (
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>{connectActionLabel}</SettingsRowTitle>
                        <SettingsRowDescription>
                          Use the workspace-owned Slack flow when the connection needs setup or attention.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <a
                        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                        href={detail.connection.connectUrl}
                      >
                        {connectActionLabel}
                      </a>
                    </SettingsRow>
                  ) : null}
                  {detail.connection.status.connected ? (
                    <SettingsRow>
                      <SettingsRowLabel>
                        <SettingsRowTitle>Disconnect Slack</SettingsRowTitle>
                        <SettingsRowDescription>
                          Remove the current Slack connection from this workspace.
                        </SettingsRowDescription>
                      </SettingsRowLabel>
                      <Button
                        disabled={isPending}
                        onClick={handleDisconnect}
                        type="button"
                        variant="outline"
                      >
                        Disconnect
                      </Button>
                    </SettingsRow>
                  ) : null}
                </SettingsCard>
              </SettingsSection>
            </div>
          </SettingsPage>
        }
      />

      <IntegrationStickySaveBar
        description="Review the changes, then save or discard them."
        hasChanges={hasChanges}
        isPending={isPending || isSavingSettings}
        onDiscard={resetDraft}
        onSave={saveDraft}
        title="You have unsaved Slack changes."
      />

      <Dialog onOpenChange={setIsDangerDialogOpen} open={isDangerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm a narrower Slack setup</DialogTitle>
            <DialogDescription>
              These changes would limit who can reach Otto in Slack. Review them before you save.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 pb-5">
            <Alert variant="destructive">
              <AlertTitle>Slack access will become more limited</AlertTitle>
              <AlertDescription>
                <div className="flex flex-col gap-2">
                  {draftEffects.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIsDangerDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                submitDraft({
                  allowDestructiveChanges: true,
                })
              }
              type="button"
              variant="destructive"
            >
              Save limited access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

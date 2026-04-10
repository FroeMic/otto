"use client"

import { ArrowsClockwise, DotsThree } from "@phosphor-icons/react/ssr"
import { useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { ToolbarSearchInput } from "@/components/toolbar-search-input"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  inviteWorkspaceMembers,
  reactivateWorkspaceMember,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  suspendWorkspaceMember,
  updateWorkspaceMemberRole,
  workspaceMembersQueryOptions,
} from "@/features/workspace/api/members"
import { formatShortDate, type WorkspaceDateTimePreferences } from "@/features/workspace/date-time"

import type {
  InviteWorkspaceMembersInput,
  WorkspaceMemberDirectoryEntry,
  WorkspaceMemberRoleOption,
} from "@otto/feature-workspace-members"

export interface WorkspaceMembersTableProps {
  availableRoles: WorkspaceMemberRoleOption[]
  canManageMembers: boolean
  dateTimePreferences: WorkspaceDateTimePreferences
  entries: WorkspaceMemberDirectoryEntry[]
  orgSlug: string
}

export interface InviteMembersDialogProps {
  availableRoles: WorkspaceMemberRoleOption[]
  canManageMembers: boolean
  onSubmit: (payload: InviteWorkspaceMembersInput) => void
  open: boolean
  pending: boolean
  setOpen: (open: boolean) => void
}

export interface MemberIdentityCellProps {
  entry: WorkspaceMemberDirectoryEntry
}

export interface WorkspaceMemberActionsCellProps {
  availableRoles: WorkspaceMemberRoleOption[]
  entry: WorkspaceMemberDirectoryEntry
  onEntryUpsert: (entry: WorkspaceMemberDirectoryEntry) => void
  orgSlug: string
}

const FILTER_OPTIONS = [
  {
    label: "Active and pending",
    value: "default",
  },
  {
    label: "All",
    value: "all",
  },
  {
    label: "Active members",
    value: "active",
  },
  {
    label: "Inactive members",
    value: "inactive",
  },
  {
    label: "Invitations",
    value: "invited",
  },
] as const

type FilterValue = (typeof FILTER_OPTIONS)[number]["value"]

function parseEntryDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeWorkspaceEntry(
  entry: WorkspaceMemberDirectoryEntry,
): WorkspaceMemberDirectoryEntry {
  return {
    ...entry,
    joinedAt: parseEntryDate(entry.joinedAt)?.toISOString() ?? null,
    lastSeenAt: parseEntryDate(entry.lastSeenAt)?.toISOString() ?? null,
  }
}

function formatDate(
  value: string | null,
  dateTimePreferences: WorkspaceDateTimePreferences,
) {
  const parsed = parseEntryDate(value)

  if (!parsed) {
    return "Never"
  }

  return formatShortDate(parsed, dateTimePreferences)
}

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (character) => {
    return character.toUpperCase()
  })
}

function getAccessLabel(entry: WorkspaceMemberDirectoryEntry) {
  return (
    entry.roleName ??
    entry.role ??
    (entry.rowType === "invitation" ? "Invited" : "Member")
  )
}

function getBadgeVariant(entry: WorkspaceMemberDirectoryEntry) {
  if (entry.rowType === "invitation") {
    return entry.status === "pending" ? "secondary" : "outline"
  }

  return entry.status === "active" ? "secondary" : "outline"
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  if (parts.length === 1) {
    return parts[0]?.slice(0, 2).toUpperCase() ?? "?"
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
}

function getEntryKey(entry: WorkspaceMemberDirectoryEntry) {
  return `${entry.rowType}:${entry.membershipId ?? entry.invitationId ?? entry.id}`
}

function sortWorkspaceEntries(entries: WorkspaceMemberDirectoryEntry[]) {
  return [...entries].sort((left, right) => {
    const leftOrder =
      left.rowType === "member" && left.status === "active"
        ? 0
        : left.rowType === "member"
          ? 1
          : left.status === "pending"
            ? 2
            : 3
    const rightOrder =
      right.rowType === "member" && right.status === "active"
        ? 0
        : right.rowType === "member"
          ? 1
          : right.status === "pending"
            ? 2
            : 3

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return left.name.localeCompare(right.name)
  })
}

function mergeWorkspaceEntries(
  currentEntries: WorkspaceMemberDirectoryEntry[],
  incomingEntries: WorkspaceMemberDirectoryEntry[],
) {
  const entriesByKey = new Map(
    currentEntries.map((entry) => [getEntryKey(entry), entry]),
  )

  for (const entry of incomingEntries) {
    const normalizedEntry = normalizeWorkspaceEntry(entry)
    entriesByKey.set(getEntryKey(normalizedEntry), normalizedEntry)
  }

  return sortWorkspaceEntries(Array.from(entriesByKey.values()))
}

function parseInviteEmails(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((email) => email.trim())
        .filter(Boolean),
    ),
  )
}

export function MemberIdentityCell({ entry }: MemberIdentityCellProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar size="lg">
        {entry.avatarUrl ? (
          <AvatarImage alt={entry.name} src={entry.avatarUrl} />
        ) : null}
        <AvatarFallback>{getInitials(entry.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 truncate text-sm">
        <span className="font-medium text-foreground">{entry.name}</span>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-muted-foreground">
          {entry.subtitle ?? entry.email}
        </span>
      </div>
    </div>
  )
}

export function InviteMembersDialog({
  availableRoles,
  canManageMembers,
  onSubmit,
  open,
  pending,
  setOpen,
}: InviteMembersDialogProps) {
  const [emailsValue, setEmailsValue] = useState("")
  const [roleSlug, setRoleSlug] = useState(availableRoles[0]?.slug ?? "")

  useEffect(() => {
    if (!availableRoles.find((role) => role.slug === roleSlug)) {
      setRoleSlug(availableRoles[0]?.slug ?? "")
    }
  }, [availableRoles, roleSlug])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      setEmailsValue("")
      setRoleSlug(availableRoles[0]?.slug ?? "")
    }
  }

  if (!canManageMembers) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>
            Send one or more WorkOS invitations for this workspace. Separate
            emails with commas or new lines.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit({
              emails: parseInviteEmails(emailsValue),
              roleSlug,
            })
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="workspace-member-emails">Email</FieldLabel>
              <Textarea
                autoComplete="off"
                className="min-h-28"
                id="workspace-member-emails"
                onChange={(event) => setEmailsValue(event.target.value)}
                placeholder="email@example.com, email2@example.com"
                value={emailsValue}
              />
              <FieldDescription>
                Invited people appear in the table immediately with a pending
                invitation.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="workspace-member-role">Role</FieldLabel>
              <NativeSelect
                className="w-full"
                id="workspace-member-role"
                onChange={(event) => setRoleSlug(event.target.value)}
                size="lg"
                value={roleSlug}
              >
                {availableRoles.map((role) => (
                  <NativeSelectOption key={role.slug} value={role.slug}>
                    {role.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>
                Roles are loaded directly from WorkOS for this workspace.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              disabled={
                pending ||
                parseInviteEmails(emailsValue).length === 0 ||
                roleSlug.length === 0
              }
              type="submit"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Sending invites" : "Send invites"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function WorkspaceMemberActionsCell({
  availableRoles,
  entry,
  onEntryUpsert,
  orgSlug,
}: WorkspaceMemberActionsCellProps) {
  const queryClient = useQueryClient()
  const [pendingAction, startTransition] = useTransition()
  const [confirmationAction, setConfirmationAction] = useState<
    "revoke" | "suspend" | null
  >(null)

  function runMutation(
    action: () => Promise<WorkspaceMemberDirectoryEntry>,
    successMessage: string,
  ) {
    startTransition(async () => {
      try {
        const nextEntry = await action()

        onEntryUpsert(nextEntry)
        await queryClient.invalidateQueries(workspaceMembersQueryOptions(orgSlug))
        toast.success(successMessage)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Workspace member action failed.",
        )
      }
    })
  }

  const hasActions =
    entry.canManageRole ||
    entry.canSuspend ||
    entry.canReactivate ||
    entry.canResendInvitation ||
    entry.canRevokeInvitation

  if (!hasActions) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Open actions for ${entry.email}`}
              className="text-muted-foreground"
              disabled={pendingAction}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          {pendingAction ? (
            <ArrowsClockwise className="animate-spin" />
          ) : (
            <DotsThree />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {entry.canManageRole && entry.membershipId ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Change role</DropdownMenuSubTrigger>
              <DropdownMenuSubContent align="end">
                <DropdownMenuRadioGroup value={entry.role ?? ""}>
                  {availableRoles.map((role) => (
                    <DropdownMenuRadioItem
                      disabled={pendingAction || role.slug === entry.role}
                      key={role.slug}
                      onClick={() =>
                        runMutation(
                          () =>
                            updateWorkspaceMemberRole({
                              membershipId: entry.membershipId!,
                              orgSlug,
                              roleSlug: role.slug,
                            }),
                          `Updated ${entry.email} to ${role.name}.`,
                        )
                      }
                      value={role.slug}
                    >
                      {role.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          {entry.canSuspend && entry.membershipId ? (
            <DropdownMenuItem onClick={() => setConfirmationAction("suspend")}>
              Suspend member
            </DropdownMenuItem>
          ) : null}
          {entry.canReactivate && entry.membershipId ? (
            <DropdownMenuItem
              onClick={() =>
                runMutation(
                  () =>
                    reactivateWorkspaceMember({
                      membershipId: entry.membershipId!,
                      orgSlug,
                    }),
                  `Reactivated ${entry.email}.`,
                )
              }
            >
              Reactivate member
            </DropdownMenuItem>
          ) : null}
          {entry.canResendInvitation && entry.invitationId ? (
            <>
              {(entry.canManageRole ||
                entry.canSuspend ||
                entry.canReactivate) &&
              (entry.canResendInvitation || entry.canRevokeInvitation) ? (
                <DropdownMenuSeparator />
              ) : null}
              <DropdownMenuItem
                onClick={() =>
                  runMutation(
                    () =>
                      resendWorkspaceInvitation({
                        invitationId: entry.invitationId!,
                        orgSlug,
                      }),
                    `Resent the invitation for ${entry.email}.`,
                  )
                }
              >
                Resend invite
              </DropdownMenuItem>
            </>
          ) : null}
          {entry.canRevokeInvitation && entry.invitationId ? (
            <DropdownMenuItem onClick={() => setConfirmationAction("revoke")}>
              Revoke invite
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setConfirmationAction(null)
          }
        }}
        open={confirmationAction !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmationAction === "suspend"
                ? "Suspend member?"
                : "Revoke invitation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationAction === "suspend"
                ? `${entry.email} will lose access to this workspace until they are reactivated.`
                : `${entry.email} will no longer be able to accept this invitation.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingAction}
              onClick={() => {
                if (confirmationAction === "suspend" && entry.membershipId) {
                  runMutation(
                    () =>
                      suspendWorkspaceMember({
                        membershipId: entry.membershipId!,
                        orgSlug,
                      }),
                    `Suspended ${entry.email}.`,
                  )
                }

                if (confirmationAction === "revoke" && entry.invitationId) {
                  runMutation(
                    () =>
                      revokeWorkspaceInvitation({
                        invitationId: entry.invitationId!,
                        orgSlug,
                      }),
                    `Revoked the invitation for ${entry.email}.`,
                  )
                }

                setConfirmationAction(null)
              }}
              variant={
                confirmationAction === "revoke" ? "destructive" : "default"
              }
            >
              {pendingAction ? <Spinner data-icon="inline-start" /> : null}
              {confirmationAction === "suspend"
                ? "Suspend member"
                : "Revoke invite"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function WorkspaceMembersTable({
  availableRoles,
  canManageMembers,
  dateTimePreferences,
  entries,
  orgSlug,
}: WorkspaceMembersTableProps) {
  const queryClient = useQueryClient()
  const [directoryEntries, setDirectoryEntries] = useState(() =>
    sortWorkspaceEntries(entries.map(normalizeWorkspaceEntry)),
  )
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isInvitePending, startInviteTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<FilterValue>("default")
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    setDirectoryEntries((currentEntries) => {
      const serverEntryKeys = new Set(entries.map(getEntryKey))
      const pendingOptimisticInvites = currentEntries.filter((entry) => {
        return (
          entry.rowType === "invitation" &&
          entry.status === "pending" &&
          !serverEntryKeys.has(getEntryKey(entry))
        )
      })

      return mergeWorkspaceEntries(
        entries.map(normalizeWorkspaceEntry),
        pendingOptimisticInvites,
      )
    })
  }, [entries])

  const filteredEntries = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()

    return directoryEntries.filter((entry) => {
      if (
        statusFilter === "default" &&
        entry.status !== "active" &&
        !(entry.rowType === "invitation" && entry.status === "pending")
      ) {
        return false
      }

      if (statusFilter === "active" && entry.status !== "active") {
        return false
      }

      if (statusFilter === "inactive" && entry.status !== "inactive") {
        return false
      }

      if (statusFilter === "invited" && entry.rowType !== "invitation") {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return entry.searchText.includes(normalizedSearch)
    })
  }, [deferredSearch, directoryEntries, statusFilter])

  function upsertEntry(entry: WorkspaceMemberDirectoryEntry) {
    setDirectoryEntries((currentEntries) =>
      mergeWorkspaceEntries(currentEntries, [entry]),
    )
  }

  const columns: ColumnDef<WorkspaceMemberDirectoryEntry>[] = (() => {
    const baseColumns: ColumnDef<WorkspaceMemberDirectoryEntry>[] = [
      {
        accessorKey: "name",
        cell: ({ row }) => <MemberIdentityCell entry={row.original} />,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Member" />
        ),
      },
      {
        accessorKey: "email",
        cell: ({ row }) => (
          <span className="block min-w-0 truncate text-sm text-foreground">
            {row.original.email}
          </span>
        ),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
      },
      {
        accessorFn: (row) => `${row.rowType}:${row.status}`,
        cell: ({ row }) => (
          <Badge variant={getBadgeVariant(row.original)}>
            {formatStatusLabel(row.original.status)}
          </Badge>
        ),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        id: "status",
      },
      {
        accessorFn: (row) => getAccessLabel(row),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {getAccessLabel(row.original)}
          </span>
        ),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Access" />
        ),
        id: "access",
      },
      {
        accessorFn: (row) =>
          parseEntryDate(row.joinedAt)?.getTime() ?? 0,
        cell: ({ row }) => (
          <span className="text-sm text-foreground">
            {formatDate(row.original.joinedAt, dateTimePreferences)}
          </span>
        ),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Joined" />
        ),
        id: "joinedAt",
      },
      {
        accessorFn: (row) =>
          parseEntryDate(row.lastSeenAt)?.getTime() ?? 0,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.lastSeenAt
              ? formatDate(row.original.lastSeenAt, dateTimePreferences)
              : row.original.rowType === "invitation"
                ? "Not yet"
                : "Not available"}
          </span>
        ),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Last seen" />
        ),
        id: "lastSeenAt",
      },
    ]

    if (!canManageMembers) {
      return baseColumns
    }

    return [
      ...baseColumns,
      {
        cell: ({ row }) => (
          <WorkspaceMemberActionsCell
            availableRoles={availableRoles}
            entry={row.original}
            onEntryUpsert={upsertEntry}
            orgSlug={orgSlug}
          />
        ),
        header: "",
        id: "actions",
      },
    ]
  })()

  const toolbar = (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center">
      <ToolbarSearchInput
        aria-label="Search by name or email"
        containerClassName="w-full sm:w-[26rem] sm:max-w-none sm:flex-none"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by name or email"
        value={search}
      />
      <NativeSelect
        className="sm:w-40 sm:min-w-40 sm:max-w-40 sm:flex-none"
        onChange={(event) => setStatusFilter(event.target.value as FilterValue)}
        size="lg"
        value={statusFilter}
      >
        {FILTER_OPTIONS.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <div className="hidden flex-1 sm:block" />
      {canManageMembers ? (
        <Button
          className="self-start sm:self-auto sm:flex-none"
          onClick={() => setIsInviteOpen(true)}
        >
          Invite
        </Button>
      ) : null}
    </div>
  )

  function handleInviteSubmit(payload: InviteWorkspaceMembersInput) {
    if (payload.emails.length === 0) {
      toast.error("Enter at least one email address.")
      return
    }

    startInviteTransition(async () => {
      try {
        const result = await inviteWorkspaceMembers({
          orgSlug,
          payload,
        })

        setDirectoryEntries((currentEntries) =>
          mergeWorkspaceEntries(currentEntries, result.invited),
        )

        const invitedCount = result.invited.length

        toast.success(
          invitedCount === 1
            ? "Invitation sent."
            : `Sent ${invitedCount} invitations.`,
        )

        if (result.skipped.length > 0) {
          toast.error(result.skipped.map((item) => item.message).join(" "))
        }

        setIsInviteOpen(false)
        await queryClient.invalidateQueries(workspaceMembersQueryOptions(orgSlug))
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Workspace invite failed.",
        )
      }
    })
  }

  return (
    <>
      <div className="w-full flex-1">
        <DataTable
          bodyClassName="align-top"
          cellClassName="h-16 px-4 py-3 md:px-6"
          columns={columns}
          data={filteredEntries}
          emptyMessage="No members found."
          fillAvailableSpace
          headClassName="h-11 px-4 text-sm font-medium text-foreground md:px-6"
          headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
          rowClassName="hover:bg-transparent"
          tableClassName="min-w-full table-fixed"
          toolbar={toolbar}
          toolbarClassName="pb-4"
          viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
        />
      </div>
      <InviteMembersDialog
        availableRoles={availableRoles}
        canManageMembers={canManageMembers}
        onSubmit={handleInviteSubmit}
        open={isInviteOpen}
        pending={isInvitePending}
        setOpen={setIsInviteOpen}
      />
    </>
  )
}

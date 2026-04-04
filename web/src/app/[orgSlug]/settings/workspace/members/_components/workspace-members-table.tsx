"use client";

import {
  ArrowReloadHorizontalIcon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { ToolbarSearchInput } from "@/components/toolbar-search-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type {
  WorkspaceMemberDirectoryEntry,
  WorkspaceMemberRoleOption,
} from "@/db/control-plane";
import {
  formatShortDate,
  type WorkspaceDateTimePreferences,
} from "@/lib/date-time";

type WorkspaceMembersTableProps = {
  availableRoles: WorkspaceMemberRoleOption[];
  canManageMembers: boolean;
  dateTimePreferences: WorkspaceDateTimePreferences;
  entries: WorkspaceMemberDirectoryEntry[];
  orgSlug: string;
};

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
] as const;

type FilterValue = (typeof FILTER_OPTIONS)[number]["value"];

type MembersInviteResponse = {
  invited: WorkspaceMemberDirectoryEntry[];
  skipped: Array<{
    email: string;
    message: string;
  }>;
};

function parseEntryDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeWorkspaceEntry(
  entry: WorkspaceMemberDirectoryEntry,
): WorkspaceMemberDirectoryEntry {
  return {
    ...entry,
    joinedAt: parseEntryDate(entry.joinedAt),
    lastSeenAt: parseEntryDate(entry.lastSeenAt),
  };
}

function formatDate(
  value: Date | null,
  dateTimePreferences: WorkspaceDateTimePreferences,
) {
  if (!value) {
    return "Never";
  }

  return formatShortDate(value, dateTimePreferences);
}

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (character) => {
    return character.toUpperCase();
  });
}

function getAccessLabel(entry: WorkspaceMemberDirectoryEntry) {
  return (
    entry.roleName ??
    entry.role ??
    (entry.rowType === "invitation" ? "Invited" : "Member")
  );
}

function getBadgeVariant(
  entry: WorkspaceMemberDirectoryEntry,
): React.ComponentProps<typeof Badge>["variant"] {
  if (entry.rowType === "invitation") {
    return entry.status === "pending" ? "secondary" : "outline";
  }

  return entry.status === "active" ? "secondary" : "outline";
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function getEntryKey(entry: WorkspaceMemberDirectoryEntry) {
  return `${entry.rowType}:${entry.membershipId ?? entry.invitationId ?? entry.id}`;
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
            : 3;
    const rightOrder =
      right.rowType === "member" && right.status === "active"
        ? 0
        : right.rowType === "member"
          ? 1
          : right.status === "pending"
            ? 2
            : 3;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

function mergeWorkspaceEntries(
  currentEntries: WorkspaceMemberDirectoryEntry[],
  incomingEntries: WorkspaceMemberDirectoryEntry[],
) {
  const entriesByKey = new Map(
    currentEntries.map((entry) => [getEntryKey(entry), entry]),
  );

  for (const entry of incomingEntries) {
    const normalizedEntry = normalizeWorkspaceEntry(entry);
    entriesByKey.set(getEntryKey(normalizedEntry), normalizedEntry);
  }

  return sortWorkspaceEntries(Array.from(entriesByKey.values()));
}

function parseInviteEmails(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((email) => email.trim())
        .filter(Boolean),
    ),
  );
}

function MemberIdentityCell({
  entry,
}: {
  entry: WorkspaceMemberDirectoryEntry;
}) {
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
  );
}

function InviteMembersDialog({
  availableRoles,
  canManageMembers,
  onSubmit,
  open,
  pending,
  setOpen,
}: {
  availableRoles: WorkspaceMemberRoleOption[];
  canManageMembers: boolean;
  onSubmit: (emails: string[], roleSlug: string) => void;
  open: boolean;
  pending: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [emailsValue, setEmailsValue] = React.useState("");
  const [roleSlug, setRoleSlug] = React.useState(availableRoles[0]?.slug ?? "");

  React.useEffect(() => {
    if (!availableRoles.find((role) => role.slug === roleSlug)) {
      setRoleSlug(availableRoles[0]?.slug ?? "");
    }
  }, [availableRoles, roleSlug]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setEmailsValue("");
      setRoleSlug(availableRoles[0]?.slug ?? "");
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(parseInviteEmails(emailsValue), roleSlug);
  };

  if (!canManageMembers) {
    return null;
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
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
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
  );
}

function WorkspaceMemberActionsCell({
  availableRoles,
  entry,
  onEntryUpsert,
  orgSlug,
}: {
  availableRoles: WorkspaceMemberRoleOption[];
  entry: WorkspaceMemberDirectoryEntry;
  onEntryUpsert: (entry: WorkspaceMemberDirectoryEntry) => void;
  orgSlug: string;
}) {
  const router = useRouter();
  const [pendingAction, startTransition] = React.useTransition();
  const [confirmationAction, setConfirmationAction] = React.useState<
    "revoke" | "suspend" | null
  >(null);

  const runMutation = (
    endpoint: string,
    successMessage: string,
    options?: {
      body?: Record<string, unknown>;
    },
  ) => {
    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          body: options?.body ? JSON.stringify(options.body) : undefined,
          headers: options?.body
            ? {
                "Content-Type": "application/json",
              }
            : undefined,
          method: "POST",
        });
        const payload = (await response.json().catch(() => null)) as {
          entry?: WorkspaceMemberDirectoryEntry;
          message?: string;
        } | null;

        if (!response.ok) {
          throw new Error(
            payload?.message ??
              `Workspace member action failed with status ${response.status}.`,
          );
        }

        if (payload?.entry) {
          onEntryUpsert(payload.entry);
        }

        toast.success(successMessage);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Workspace member action failed.",
        );
      }
    });
  };

  const hasActions =
    entry.canManageRole ||
    entry.canSuspend ||
    entry.canReactivate ||
    entry.canResendInvitation ||
    entry.canRevokeInvitation;

  if (!hasActions) {
    return null;
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
            <HugeiconsIcon
              className="animate-spin"
              icon={ArrowReloadHorizontalIcon}
            />
          ) : (
            <HugeiconsIcon icon={MoreHorizontalIcon} />
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
                          `/api/workspace/${orgSlug}/members/${entry.membershipId}/role`,
                          `Updated ${entry.email} to ${role.name}.`,
                          {
                            body: {
                              roleSlug: role.slug,
                            },
                          },
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
                  `/api/workspace/${orgSlug}/members/${entry.membershipId}/reactivate`,
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
                    `/api/workspace/${orgSlug}/members/invitations/${entry.invitationId}/resend`,
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
            setConfirmationAction(null);
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
                    `/api/workspace/${orgSlug}/members/${entry.membershipId}/suspend`,
                    `Suspended ${entry.email}.`,
                  );
                }

                if (confirmationAction === "revoke" && entry.invitationId) {
                  runMutation(
                    `/api/workspace/${orgSlug}/members/invitations/${entry.invitationId}/revoke`,
                    `Revoked the invitation for ${entry.email}.`,
                  );
                }

                setConfirmationAction(null);
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
  );
}

export function WorkspaceMembersTable({
  availableRoles,
  canManageMembers,
  dateTimePreferences,
  entries,
  orgSlug,
}: WorkspaceMembersTableProps) {
  const router = useRouter();
  const [directoryEntries, setDirectoryEntries] = React.useState(() =>
    sortWorkspaceEntries(entries.map(normalizeWorkspaceEntry)),
  );
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [isInvitePending, startInviteTransition] = React.useTransition();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] =
    React.useState<FilterValue>("default");
  const deferredSearch = React.useDeferredValue(search);

  React.useEffect(() => {
    setDirectoryEntries((currentEntries) => {
      const serverEntryKeys = new Set(entries.map(getEntryKey));
      const pendingOptimisticInvites = currentEntries.filter((entry) => {
        return (
          entry.rowType === "invitation" &&
          entry.status === "pending" &&
          !serverEntryKeys.has(getEntryKey(entry))
        );
      });

      return mergeWorkspaceEntries(
        entries.map(normalizeWorkspaceEntry),
        pendingOptimisticInvites,
      );
    });
  }, [entries]);

  const filteredEntries = React.useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return directoryEntries.filter((entry) => {
      if (
        statusFilter === "default" &&
        entry.status !== "active" &&
        !(entry.rowType === "invitation" && entry.status === "pending")
      ) {
        return false;
      }

      if (statusFilter === "active" && entry.status !== "active") {
        return false;
      }

      if (statusFilter === "inactive" && entry.status !== "inactive") {
        return false;
      }

      if (statusFilter === "invited" && entry.rowType !== "invitation") {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return entry.searchText.includes(normalizedSearch);
    });
  }, [deferredSearch, directoryEntries, statusFilter]);

  const upsertEntry = (entry: WorkspaceMemberDirectoryEntry) => {
    setDirectoryEntries((currentEntries) =>
      mergeWorkspaceEntries(currentEntries, [entry]),
    );
  };

  const columns: ColumnDef<WorkspaceMemberDirectoryEntry>[] = (() => {
    const baseColumns: ColumnDef<WorkspaceMemberDirectoryEntry>[] = [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Member" />
        ),
        cell: ({ row }) => <MemberIdentityCell entry={row.original} />,
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => (
          <span className="block min-w-0 truncate text-sm text-foreground">
            {row.original.email}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => `${row.rowType}:${row.status}`,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge variant={getBadgeVariant(row.original)}>
            {formatStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "access",
        accessorFn: (row) => getAccessLabel(row),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Access" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {getAccessLabel(row.original)}
          </span>
        ),
      },
      {
        id: "joinedAt",
        accessorFn: (row) => row.joinedAt?.getTime() ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Joined" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-foreground">
            {formatDate(row.original.joinedAt, dateTimePreferences)}
          </span>
        ),
      },
      {
        id: "lastSeenAt",
        accessorFn: (row) => row.lastSeenAt?.getTime() ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Last seen" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.lastSeenAt
              ? formatDate(row.original.lastSeenAt, dateTimePreferences)
              : row.original.rowType === "invitation"
                ? "Not yet"
                : "Not available"}
          </span>
        ),
      },
    ];

    if (!canManageMembers) {
      return baseColumns;
    }

    return [
      ...baseColumns,
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <WorkspaceMemberActionsCell
            availableRoles={availableRoles}
            entry={row.original}
            onEntryUpsert={upsertEntry}
            orgSlug={orgSlug}
          />
        ),
      },
    ];
  })();

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
  );

  const handleInviteSubmit = (emails: string[], roleSlug: string) => {
    if (emails.length === 0) {
      toast.error("Enter at least one email address.");
      return;
    }

    startInviteTransition(async () => {
      try {
        const response = await fetch(
          `/api/workspace/${orgSlug}/members/invitations`,
          {
            body: JSON.stringify({
              emails,
              roleSlug,
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | (MembersInviteResponse & {
              message?: string;
            })
          | null;

        if (!response.ok) {
          throw new Error(
            payload?.message ??
              `Workspace invitation failed with status ${response.status}.`,
          );
        }

        setDirectoryEntries((currentEntries) =>
          mergeWorkspaceEntries(currentEntries, payload?.invited ?? []),
        );

        const invitedCount = payload?.invited.length ?? 0;

        toast.success(
          invitedCount === 1
            ? "Invitation sent."
            : `Sent ${invitedCount} invitations.`,
        );

        if (payload?.skipped.length) {
          toast.error(payload.skipped.map((item) => item.message).join(" "));
        }

        setIsInviteOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Workspace invite failed.",
        );
      }
    });
  };

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
  );
}

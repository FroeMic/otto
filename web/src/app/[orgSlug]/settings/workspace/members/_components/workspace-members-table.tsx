"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { ToolbarSearchInput } from "@/components/toolbar-search-input";
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import type { WorkspaceMemberDirectoryEntry } from "@/db/control-plane";

type WorkspaceMembersTableProps = {
  canManageMembers: boolean;
  entries: WorkspaceMemberDirectoryEntry[];
  orgSlug: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const FILTER_OPTIONS = [
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

function formatDate(value: Date | null) {
  if (!value) {
    return "Never";
  }

  return dateFormatter.format(value);
}

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (character) => {
    return character.toUpperCase();
  });
}

function getAccessLabel(entry: WorkspaceMemberDirectoryEntry) {
  if (entry.rowType === "invitation") {
    return "Invitation";
  }

  return entry.role ? formatStatusLabel(entry.role) : "Member";
}

function getBadgeVariant(
  entry: WorkspaceMemberDirectoryEntry,
): React.ComponentProps<typeof Badge>["variant"] {
  if (entry.rowType === "invitation") {
    return entry.status === "pending" ? "secondary" : "outline";
  }

  return entry.role === "admin" || entry.role === "owner"
    ? "secondary"
    : "outline";
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

function InviteMemberDialog({
  canManageMembers,
  onSubmit,
  open,
  pending,
  setOpen,
}: {
  canManageMembers: boolean;
  onSubmit: (email: string) => void;
  open: boolean;
  pending: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [email, setEmail] = React.useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setEmail("");
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(email);
  };

  if (!canManageMembers) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Send a WorkOS invitation email for this workspace. New members
            appear here after they accept the invite.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="workspace-member-email">Email</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  autoComplete="email"
                  id="workspace-member-email"
                  inputMode="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@example.com"
                  type="email"
                  value={email}
                />
              </InputGroup>
              <FieldDescription>
                Invitations use the workspace&apos;s default WorkOS access role.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              disabled={pending || email.trim().length === 0}
              type="submit"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Sending" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const columns: ColumnDef<WorkspaceMemberDirectoryEntry>[] = [
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
        {formatDate(row.original.joinedAt)}
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
          ? formatDate(row.original.lastSeenAt)
          : "Not yet"}
      </span>
    ),
  },
];

export function WorkspaceMembersTable({
  canManageMembers,
  entries,
  orgSlug,
}: WorkspaceMembersTableProps) {
  const router = useRouter();
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [isInvitePending, startInviteTransition] = React.useTransition();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<FilterValue>("all");
  const deferredSearch = React.useDeferredValue(search);
  const filteredEntries = React.useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return entries.filter((entry) => {
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
  }, [deferredSearch, entries, statusFilter]);

  const handleInviteSubmit = (email: string) => {
    startInviteTransition(async () => {
      try {
        const response = await fetch(
          `/api/workspace/${orgSlug}/members/invitations`,
          {
            body: JSON.stringify({ email }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        );
        const payload = (await response.json().catch(() => null)) as {
          action?: "resent" | "sent";
          message?: string;
        } | null;

        if (!response.ok) {
          throw new Error(
            payload?.message ??
              `Workspace invitation failed with status ${response.status}.`,
          );
        }

        toast.success(
          payload?.action === "resent"
            ? "Invitation resent."
            : "Invitation sent.",
        );
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
      <DataTable
        bodyClassName="align-top"
        cellClassName="h-16 px-4 py-3"
        columns={columns}
        data={filteredEntries}
        emptyMessage="No members match the current filters."
        fillAvailableSpace
        headClassName="h-11 px-4 text-sm font-medium text-foreground"
        headerClassName="[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10 [&_tr]:bg-background"
        rowClassName="hover:bg-transparent"
        tableClassName="min-w-full table-fixed"
        toolbar={
          <>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ToolbarSearchInput
                aria-label="Search workspace members"
                containerClassName="max-w-none sm:w-[28rem]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or email"
                value={search}
              />
              <NativeSelect
                aria-label="Filter workspace members"
                className="min-w-36"
                onChange={(event) =>
                  setStatusFilter(event.target.value as FilterValue)
                }
                size="lg"
                value={statusFilter}
              >
                {FILTER_OPTIONS.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {canManageMembers ? (
              <Button onClick={() => setIsInviteOpen(true)} type="button">
                Invite
              </Button>
            ) : null}
          </>
        }
        toolbarClassName="pb-4"
        viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
      />
      <InviteMemberDialog
        canManageMembers={canManageMembers}
        onSubmit={handleInviteSubmit}
        open={isInviteOpen}
        pending={isInvitePending}
        setOpen={setIsInviteOpen}
      />
    </>
  );
}

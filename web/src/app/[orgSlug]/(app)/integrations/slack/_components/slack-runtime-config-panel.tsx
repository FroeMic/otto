"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  type ReadonlyURLSearchParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

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
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deriveSlackPolicyEffects,
  isSlackPolicyDestructive,
  type SlackPolicyDerivedEffects,
} from "@/tools/slack/policy";
import type { AgentCapability, AgentCapabilityDirection } from "@/tools/types";

type SlackDirectoryOption = {
  memberCount?: number | null;
  description: string | null;
  id: string;
  isArchived?: boolean;
  isMember?: boolean;
  label: string;
  secondaryLabel: string | null;
  visibility?: "private" | "public" | null;
};

type SlackRuntimeConfigSurface = {
  availableChannels: SlackDirectoryOption[];
  availableUsers: SlackDirectoryOption[];
  config: {
    ackReactionEnabled: boolean;
    allowedChannelIds: string[];
    allowedUserIds: string[];
    answerInThreads: boolean;
    channelAccessMode: "manual_allowlist" | "member_of_channels";
    enabled: boolean;
    entryVersion: number;
    installState: "installed" | "uninstalled";
    requireMentionInChannels: boolean;
    schemaVersion: string;
  };
  description: string;
  derivedEffects?: {
    warnings?: string[];
    wouldDisableChannelReplies?: boolean;
    wouldDisableDMs?: boolean;
    wouldFullyLockOutSlack?: boolean;
  };
  key: string;
  kind: string;
  label: string;
};

type SelectedDirectoryEntry = SlackDirectoryOption & {
  isMissing?: boolean;
};

type SlackPersonRow = SlackDirectoryOption & {
  isSelected: boolean;
  searchText: string;
};

type SlackChannelRow = SlackDirectoryOption & {
  isSelected: boolean;
  replyAccessLabel: string;
  replyAccessVariant: "default" | "destructive" | "outline" | "secondary";
  searchText: string;
};

type SlackRuntimeConfigPanelProps = {
  agentCapabilities: AgentCapability[];
  connectedAtLabel: string | null;
  directoryRefreshError: string | null;
  initialSurface: SlackRuntimeConfigSurface | null;
  orgSlug: string;
  runtimeApplyStatusLabel: string | null;
  runtimeStatusLabel: string;
  slackStatusLabel: string;
  slackStatusVariant: "default" | "destructive" | "outline" | "secondary";
  slackTeamName: string | null;
  statusAlert: {
    description: string;
    title: string;
    variant: "default" | "destructive";
  } | null;
};

const EMPTY_DRAFT_EFFECTS: SlackPolicyDerivedEffects = {
  channelRepliesEnabled: false,
  dmEnabled: false,
  effectiveChannelCount: 0,
  effectiveChannelIds: [],
  warnings: [],
  wouldDisableChannelReplies: false,
  wouldDisableDMs: false,
  wouldFullyLockOutSlack: false,
};

const capabilityDirectionConfig: Record<
  AgentCapabilityDirection,
  { label: string; order: number }
> = {
  trigger: { label: "Session triggers", order: 0 },
  tool: { label: "Tools", order: 1 },
  read: { label: "Read access", order: 2 },
};

function groupCapabilities(capabilities: AgentCapability[]) {
  const groups = new Map<AgentCapabilityDirection, AgentCapability[]>();

  for (const capability of capabilities) {
    const currentGroup = groups.get(capability.direction) ?? [];
    currentGroup.push(capability);
    groups.set(capability.direction, currentGroup);
  }

  return [...groups.entries()].sort(
    ([left], [right]) =>
      capabilityDirectionConfig[left].order -
      capabilityDirectionConfig[right].order,
  );
}

function getInitials(label: string) {
  const parts = label
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "SL";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function normalizeIds(ids: string[]) {
  return [...ids].sort();
}

function formatChannelLabel(label: string) {
  return label.startsWith("#") ? label : `#${label}`;
}

function getChannelAccessModeLabel(
  value: "manual_allowlist" | "member_of_channels" | null | undefined,
) {
  if (value === "member_of_channels") {
    return "Any channel where Otto has been added";
  }

  return "Only selected channels";
}

function areConfigsEqual(
  left: SlackRuntimeConfigSurface["config"],
  right: SlackRuntimeConfigSurface["config"],
) {
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
  );
}

function getSelectedDirectoryEntries(
  availableOptions: SlackDirectoryOption[],
  selectedIds: string[],
): SelectedDirectoryEntry[] {
  const optionMap = new Map(
    availableOptions.map((option) => [option.id, option]),
  );

  return selectedIds.map((id) => {
    const option = optionMap.get(id);

    return option
      ? option
      : {
          description:
            "This saved selection is not present in the latest Slack sync.",
          id,
          isMissing: true,
          label: id,
          secondaryLabel: "Unavailable in current Slack sync",
        };
  });
}

function getJoinedChannelEntries(
  availableOptions: SlackDirectoryOption[],
): SelectedDirectoryEntry[] {
  return availableOptions.filter((option) => option.isMember);
}

function getChannelMembershipAction(option: SlackDirectoryOption) {
  if (option.isArchived) {
    return {
      action: null,
      disabled: true,
      label: "Archived",
    } as const;
  }

  if (option.isMember) {
    return {
      action: "leave",
      disabled: false,
      label: "Remove Otto",
    } as const;
  }

  if (option.visibility === "private") {
    return {
      action: null,
      disabled: true,
      label: "Invite in Slack",
    } as const;
  }

  return {
    action: "join",
    disabled: false,
    label: "Add Otto",
  } as const;
}

function getChannelReplyAccess(input: {
  channel: SlackDirectoryOption;
  channelAccessMode: "manual_allowlist" | "member_of_channels";
  selectedIds: string[];
}) {
  const isSelected = input.selectedIds.includes(input.channel.id);
  const isMember = Boolean(input.channel.isMember);

  if (input.channelAccessMode === "member_of_channels") {
    return isMember
      ? {
          label: "Can reply",
          variant: "secondary" as const,
        }
      : {
          label: "Not added yet",
          variant: "outline" as const,
        };
  }

  if (isSelected && isMember) {
    return {
      label: "Can reply",
      variant: "secondary" as const,
    };
  }

  if (isSelected && !isMember) {
    return {
      label: "Selected, add Otto",
      variant: "outline" as const,
    };
  }

  if (!isSelected && isMember) {
    return {
      label: "Added, not selected",
      variant: "outline" as const,
    };
  }

  return {
    label: "Not allowed",
    variant: "outline" as const,
  };
}

function updateQueryString(
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  updates: Record<string, string | null>,
) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      params.delete(key);
      continue;
    }

    params.set(key, value);
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

function DirectoryIdentity(props: {
  kind: "channel" | "user";
  option: SelectedDirectoryEntry;
}) {
  const { kind, option } = props;
  const secondaryText = option.secondaryLabel ?? option.description;

  return (
    <div className="flex min-w-0 items-start gap-3">
      {kind === "user" ? (
        <Avatar size="sm">
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
            {kind === "channel"
              ? formatChannelLabel(option.label)
              : option.label}
          </p>
          {option.isMissing ? (
            <Badge variant="outline">Unavailable</Badge>
          ) : null}
        </div>
        {secondaryText ? (
          <p className="truncate text-xs text-muted-foreground">
            {secondaryText}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SummaryValue({
  action,
  text,
}: {
  action?: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-sm text-muted-foreground">{text}</span>
      {action}
    </div>
  );
}

function SaveBar(props: {
  hasChanges: boolean;
  isPending: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  const { hasChanges, isPending, onReset, onSave } = props;

  return (
    <div className="fixed right-6 bottom-6 left-6 z-30 sm:left-[max(1.5rem,calc(50%-24rem))] sm:right-auto sm:w-[min(100%-3rem,48rem)]">
      <div className="flex flex-col gap-3 rounded-2xl border bg-background/95 p-4 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/85 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            You have unsaved Slack changes.
          </p>
          <p className="text-xs text-muted-foreground">
            Review the changes, then save or discard them.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            disabled={isPending || !hasChanges}
            onClick={onReset}
            type="button"
            variant="outline"
          >
            Discard
          </Button>
          <Button
            disabled={isPending || !hasChanges}
            onClick={onSave}
            type="button"
          >
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SlackRuntimeConfigPanel(props: SlackRuntimeConfigPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [surface, setSurface] = useState(props.initialSurface);
  const [draft, setDraft] = useState(props.initialSurface?.config ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [pendingMembershipAction, setPendingMembershipAction] = useState<{
    action: "join" | "leave";
    channelId: string;
  } | null>(null);
  const [isDangerDialogOpen, setIsDangerDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const tabParam = searchParams.get("tab");
  const currentTab:
    | "capabilities"
    | "status"
    | "configuration"
    | "people"
    | "channels" =
    tabParam === "status" ||
    tabParam === "capabilities" ||
    tabParam === "configuration" ||
    tabParam === "people" ||
    tabParam === "channels"
      ? tabParam
      : "capabilities";
  const hasStatusIssue = Boolean(props.statusAlert);
  const hasChanges =
    surface && draft ? !areConfigsEqual(draft, surface.config) : false;
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
  );
  const requiresDestructiveConfirmation = draft
    ? isSlackPolicyDestructive(draftEffects)
    : false;
  const selectedUsers = useMemo(
    () =>
      surface && draft
        ? getSelectedDirectoryEntries(
            surface.availableUsers,
            draft.allowedUserIds,
          )
        : [],
    [draft, surface],
  );
  const selectedChannels = useMemo(() => {
    if (!surface || !draft) {
      return [];
    }

    if (draft.channelAccessMode === "member_of_channels") {
      return getJoinedChannelEntries(surface.availableChannels);
    }

    return getSelectedDirectoryEntries(
      surface.availableChannels,
      draft.allowedChannelIds,
    );
  }, [draft, surface]);
  const missingSelectedUsers = selectedUsers.filter((entry) => entry.isMissing);
  const missingSelectedChannels = selectedChannels.filter(
    (entry) => entry.isMissing,
  );
  const selectedPeopleCount = draft?.allowedUserIds.length ?? 0;
  const selectedChannelCount =
    draft?.channelAccessMode === "member_of_channels"
      ? selectedChannels.length
      : (draft?.allowedChannelIds.length ?? 0);

  const peopleRows = useMemo<SlackPersonRow[]>(() => {
    if (!surface || !draft) {
      return [];
    }

    return surface.availableUsers.map((user) => ({
      ...user,
      isSelected: draft.allowedUserIds.includes(user.id),
      searchText: [user.label, user.secondaryLabel, user.description, user.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    }));
  }, [draft, surface]);

  const channelRows = useMemo<SlackChannelRow[]>(() => {
    if (!surface || !draft) {
      return [];
    }

    return surface.availableChannels.map((channel) => {
      const replyAccess = getChannelReplyAccess({
        channel,
        channelAccessMode: draft.channelAccessMode,
        selectedIds: draft.allowedChannelIds,
      });

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
      };
    });
  }, [draft, surface]);

  useEffect(() => {
    if (!hasChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (
        anchor.target === "_blank" ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const currentUrl = new URL(window.location.href);
      const nextUrl = new URL(anchor.href, window.location.href);

      if (
        currentUrl.pathname === nextUrl.pathname &&
        currentUrl.search === nextUrl.search &&
        currentUrl.hash === nextUrl.hash
      ) {
        return;
      }

      if (
        window.confirm(
          "You have unsaved Slack changes. Leave this page without saving?",
        )
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasChanges]);

  function setTopLevelTab(
    value: "status" | "configuration" | "people" | "channels" | "capabilities",
  ) {
    router.replace(
      updateQueryString(pathname, searchParams, {
        tab: value,
      }),
      { scroll: false },
    );
  }

  function resetDraft() {
    if (!surface) {
      return;
    }

    setDraft(surface.config);
    setErrorMessage(null);
    setIsDangerDialogOpen(false);
    setMembershipError(null);
    setSuccessMessage(null);
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
    );
    setSuccessMessage(null);
  }

  function updateChannelAccessMode(
    value: "manual_allowlist" | "member_of_channels",
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            channelAccessMode: value,
          }
        : current,
    );
    setSuccessMessage(null);
  }

  function toggleAllowedUser(userId: string) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextIds = current.allowedUserIds.includes(userId)
        ? current.allowedUserIds.filter((id) => id !== userId)
        : [...current.allowedUserIds, userId];

      return {
        ...current,
        allowedUserIds: nextIds,
      };
    });
    setSuccessMessage(null);
  }

  function toggleAllowedChannel(channelId: string) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextIds = current.allowedChannelIds.includes(channelId)
        ? current.allowedChannelIds.filter((id) => id !== channelId)
        : [...current.allowedChannelIds, channelId];

      return {
        ...current,
        allowedChannelIds: nextIds,
      };
    });
    setSuccessMessage(null);
  }

  async function changeChannelMembership(
    channelId: string,
    action: "join" | "leave",
  ) {
    if (!surface) {
      return;
    }

    setMembershipError(null);
    setPendingMembershipAction({
      action,
      channelId,
    });

    try {
      const response = await fetch(
        `/api/runtime-config/${props.orgSlug}/surfaces/channel/slack/channels/${channelId}/membership`,
        {
          body: JSON.stringify({
            action,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      const payload = (await response.json()) as {
        message?: string;
        surface?: SlackRuntimeConfigSurface;
      };

      if (!response.ok || !payload.surface) {
        throw new Error(
          payload.message ?? "Slack channel membership could not be updated.",
        );
      }

      setSurface((current) =>
        current
          ? {
              ...current,
              availableChannels: payload.surface?.availableChannels ?? [],
            }
          : current,
      );
      router.refresh();
    } catch (error) {
      setMembershipError(
        error instanceof Error
          ? error.message
          : "Slack channel membership could not be updated.",
      );
    } finally {
      setPendingMembershipAction(null);
    }
  }

  function submitDraft(options?: { allowDestructiveChanges?: boolean }) {
    if (!surface || !draft) {
      return;
    }

    startTransition(() => {
      void (async () => {
        setErrorMessage(null);
        setSuccessMessage(null);

        const response = await fetch(
          `/api/runtime-config/${props.orgSlug}/surfaces/${surface.kind}/${surface.key}`,
          {
            body: JSON.stringify({
              allowDestructiveChanges:
                options?.allowDestructiveChanges === true,
              expectedEntryVersion: surface.config.entryVersion,
              patch: {
                ackReactionEnabled: draft.ackReactionEnabled,
                allowedChannelIds: draft.allowedChannelIds,
                allowedUserIds: draft.allowedUserIds,
                answerInThreads: draft.answerInThreads,
                channelAccessMode: draft.channelAccessMode,
                requireMentionInChannels: draft.requireMentionInChannels,
              },
              summary: "Updated Slack runtime config",
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "PATCH",
          },
        );

        const payload = (await response.json()) as {
          code?: string;
          message?: string;
          surface?: SlackRuntimeConfigSurface;
        };

        if (!response.ok || !payload.surface) {
          setErrorMessage(
            payload.message ??
              (payload.code === "stale_version"
                ? "Slack settings changed elsewhere. Reload and try again."
                : "Slack settings could not be saved."),
          );
          router.refresh();
          return;
        }

        setIsDangerDialogOpen(false);
        setSurface(payload.surface);
        setDraft(payload.surface.config);
        setSuccessMessage(
          "Slack settings saved. Otto will use the new settings shortly.",
        );
        router.refresh();
      })();
    });
  }

  function saveDraft() {
    if (!draft) {
      return;
    }

    if (requiresDestructiveConfirmation) {
      setIsDangerDialogOpen(true);
      return;
    }

    submitDraft();
  }

  const peopleColumns: Array<ColumnDef<SlackPersonRow>> = [
    {
      accessorKey: "label",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Person" />
      ),
      size: 280,
      cell: ({ row }) => (
        <DirectoryIdentity kind="user" option={row.original} />
      ),
    },
    {
      accessorKey: "secondaryLabel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Slack name" />
      ),
      size: 200,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.secondaryLabel ?? "Not available"}
        </span>
      ),
    },
    {
      id: "selected",
      accessorFn: (row) => (row.isSelected ? "selected" : "not-selected"),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Selected" />
      ),
      size: 120,
      cell: ({ row }) => (
        <Badge variant={row.original.isSelected ? "secondary" : "outline"}>
          {row.original.isSelected ? "Selected" : "Not selected"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      size: 140,
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
    },
  ];

  const channelColumns: Array<ColumnDef<SlackChannelRow>> = [
    {
      accessorKey: "label",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Channel" />
      ),
      size: 280,
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
    },
    {
      id: "type",
      accessorFn: (row) =>
        `${row.visibility ?? "unknown"}:${row.isArchived ? "archived" : "active"}`,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      size: 180,
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
    },
    {
      id: "selected",
      accessorFn: (row) => (row.isSelected ? "selected" : "not-selected"),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Selected" />
      ),
      size: 140,
      cell: ({ row }) => (
        <Badge variant={row.original.isSelected ? "secondary" : "outline"}>
          {row.original.isSelected ? "Selected" : "Not selected"}
        </Badge>
      ),
    },
    {
      id: "otto",
      accessorFn: (row) => (row.isMember ? "added" : "not-added"),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Otto added" />
      ),
      size: 140,
      cell: ({ row }) => (
        <Badge variant={row.original.isMember ? "secondary" : "outline"}>
          {row.original.isMember ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      id: "replyAccess",
      accessorFn: (row) => row.replyAccessLabel,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reply access" />
      ),
      size: 170,
      cell: ({ row }) => (
        <Badge variant={row.original.replyAccessVariant}>
          {row.original.replyAccessLabel}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      size: 260,
      cell: ({ row }) => {
        const membershipAction = getChannelMembershipAction(row.original);
        const isMembershipPending =
          pendingMembershipAction?.channelId === row.original.id;

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
              disabled={
                membershipAction.disabled || pendingMembershipAction !== null
              }
              onClick={() => {
                if (!membershipAction.action) {
                  return;
                }

                void changeChannelMembership(
                  row.original.id,
                  membershipAction.action,
                );
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
        );
      },
    },
  ];

  if (!surface || !draft) {
    return (
      <SettingsPage className="mx-0 max-w-2xl">
        <div className="flex flex-col gap-8 pb-24">
          <SettingsSection>
            <SettingsSectionTitle>Connection</SettingsSectionTitle>
            <SettingsSectionDescription>
              Connect Slack before you choose who can use Otto and where Otto
              can reply.
            </SettingsSectionDescription>
            <SettingsCard>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Status</SettingsRowTitle>
                  <SettingsRowDescription>
                    Slack must be connected before Otto can answer messages.
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <Badge variant={props.slackStatusVariant}>
                  {props.slackStatusLabel}
                </Badge>
              </SettingsRow>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Slack workspace</SettingsRowTitle>
                </SettingsRowLabel>
                <span className="text-sm text-muted-foreground">
                  {props.slackTeamName ?? "Not connected"}
                </span>
              </SettingsRow>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Connected on</SettingsRowTitle>
                </SettingsRowLabel>
                <span className="text-sm text-muted-foreground">
                  {props.connectedAtLabel ?? "Not connected yet"}
                </span>
              </SettingsRow>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Otto status</SettingsRowTitle>
                </SettingsRowLabel>
                <span className="text-sm text-muted-foreground">
                  {props.runtimeStatusLabel}
                </span>
              </SettingsRow>
            </SettingsCard>
          </SettingsSection>

          <Alert>
            <AlertTitle>
              Slack settings will appear here after you connect Slack
            </AlertTitle>
            <AlertDescription>
              Once Slack is connected, you can choose reply behavior, selected
              people, and channel access from this page.
            </AlertDescription>
          </Alert>
        </div>
      </SettingsPage>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Slack settings could not be saved</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage && !hasChanges ? (
        <Alert>
          <AlertTitle>Slack settings saved</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {draftEffects.warnings.length > 0 ? (
        <Alert
          variant={
            draftEffects.wouldFullyLockOutSlack ? "destructive" : "default"
          }
        >
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

      <Tabs
        className="flex flex-col gap-6"
        value={currentTab}
        onValueChange={(value) =>
          setTopLevelTab(
            value as
              | "capabilities"
              | "status"
              | "configuration"
              | "people"
              | "channels",
          )
        }
      >
        <TabsList className="h-auto justify-start overflow-x-auto p-1">
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="status">
            <span>Status</span>
            {hasStatusIssue ? (
              <span className="size-2 rounded-full bg-destructive" />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <SettingsPage className="mx-0 max-w-2xl">
            <div className="flex flex-col gap-8">
              {props.statusAlert ? (
                <Alert variant={props.statusAlert.variant}>
                  <AlertTitle>{props.statusAlert.title}</AlertTitle>
                  <AlertDescription>
                    {props.statusAlert.description}
                  </AlertDescription>
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
                        Otto can only reply in Slack after the connection is
                        healthy.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Badge variant={props.slackStatusVariant}>
                      {props.slackStatusLabel}
                    </Badge>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Slack workspace</SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {props.slackTeamName ?? "Not connected"}
                    </span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Connected on</SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {props.connectedAtLabel ?? "Not available"}
                    </span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Otto status</SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {props.runtimeStatusLabel}
                    </span>
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>Last update</SettingsRowTitle>
                    </SettingsRowLabel>
                    <span className="text-sm text-muted-foreground">
                      {props.runtimeApplyStatusLabel ?? "No recent update"}
                    </span>
                  </SettingsRow>
                </SettingsCard>
              </SettingsSection>
            </div>
          </SettingsPage>
        </TabsContent>

        <TabsContent value="configuration">
          <SettingsPage className="mx-0 max-w-2xl">
            <div className="flex flex-col gap-8">
              <SettingsSection>
                <SettingsSectionTitle>Replies</SettingsSectionTitle>
                <SettingsSectionDescription>
                  Choose how Otto behaves once a Slack message is allowed
                  through.
                </SettingsSectionDescription>
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>
                        Acknowledgement reaction
                      </SettingsRowTitle>
                      <SettingsRowDescription>
                        Add Otto&apos;s standard reaction while it is preparing
                        a reply.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Switch
                      checked={draft.ackReactionEnabled}
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
                      checked={draft.answerInThreads}
                      onCheckedChange={(checked) =>
                        updateBooleanSetting("answerInThreads", checked)
                      }
                    />
                  </SettingsRow>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>
                        Require @mention in channels
                      </SettingsRowTitle>
                      <SettingsRowDescription>
                        When this is on, Otto only replies in channels after an
                        explicit mention.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Switch
                      checked={draft.requireMentionInChannels}
                      onCheckedChange={(checked) =>
                        updateBooleanSetting(
                          "requireMentionInChannels",
                          checked,
                        )
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
                      <SettingsRowTitle>
                        People who can message Otto
                      </SettingsRowTitle>
                      <SettingsRowDescription>
                        {missingSelectedUsers.length > 0
                          ? `${missingSelectedUsers.length} saved selection${missingSelectedUsers.length === 1 ? "" : "s"} are missing from the latest Slack sync.`
                          : "Choose the people who can start Slack conversations with Otto."}
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <SummaryValue
                      action={
                        <Button
                          onClick={() => setTopLevelTab("people")}
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
                        {draft.channelAccessMode === "member_of_channels"
                          ? "Any channel where Otto has been added becomes active right away."
                          : "Otto only replies in channels that are selected here and already include Otto."}
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <Select
                      value={draft.channelAccessMode}
                      onValueChange={(value) => {
                        if (
                          value === "manual_allowlist" ||
                          value === "member_of_channels"
                        ) {
                          updateChannelAccessMode(value);
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
                        {draft.channelAccessMode === "member_of_channels"
                          ? "Channels where Otto is active"
                          : "Selected channels"}
                      </SettingsRowTitle>
                      <SettingsRowDescription>
                        {draft.channelAccessMode === "member_of_channels"
                          ? "Otto can reply in every channel listed as added."
                          : missingSelectedChannels.length > 0
                            ? `${missingSelectedChannels.length} saved selection${missingSelectedChannels.length === 1 ? "" : "s"} are missing from the latest Slack sync.`
                            : "Review selected channels and add Otto where needed."}
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                    <SummaryValue
                      action={
                        <Button
                          onClick={() => setTopLevelTab("channels")}
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
        </TabsContent>

        <TabsContent value="people">
          <div className="flex flex-col gap-6">
            {props.directoryRefreshError ? (
              <Alert>
                <AlertTitle>
                  Slack people and channels could not be refreshed
                </AlertTitle>
                <AlertDescription>
                  Showing the last synced Slack directory instead.{" "}
                  {props.directoryRefreshError}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  Access Policy:
                </span>{" "}
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
                searchInputClassName="h-9 w-full sm:w-[26rem] sm:max-w-none sm:flex-none"
                searchKeys={["searchText"]}
                searchPlaceholder="Search people"
                tableClassName="min-w-full table-fixed"
                viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="channels">
          <div className="flex flex-col gap-6">
            {props.directoryRefreshError ? (
              <Alert>
                <AlertTitle>
                  Slack people and channels could not be refreshed
                </AlertTitle>
                <AlertDescription>
                  Showing the last synced Slack directory instead.{" "}
                  {props.directoryRefreshError}
                </AlertDescription>
              </Alert>
            ) : null}

            {membershipError ? (
              <Alert variant="destructive">
                <AlertTitle>Channel membership could not be updated</AlertTitle>
                <AlertDescription>{membershipError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  Channel Policy:
                </span>{" "}
                {draft.channelAccessMode === "member_of_channels"
                  ? "Otto can be added to any channel. Only authorized users can chat with him."
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
                searchInputClassName="h-9 w-full sm:w-[26rem] sm:max-w-none sm:flex-none"
                searchKeys={["searchText"]}
                searchPlaceholder="Search channels"
                tableClassName="min-w-full table-fixed"
                viewportClassName="max-w-full min-w-0 overflow-x-auto overflow-y-auto"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="capabilities">
          <SettingsPage className="mx-0 max-w-2xl">
            <div className="flex flex-col gap-8">
              {props.agentCapabilities.length > 0 ? (
                groupCapabilities(props.agentCapabilities).map(
                  ([direction, capabilities]) => (
                    <div className="flex flex-col gap-3" key={direction}>
                      <SettingsSectionTitle>
                        {capabilityDirectionConfig[direction].label}
                      </SettingsSectionTitle>
                      <SettingsCard>
                        {capabilities.map((capability) => (
                          <SettingsRow key={capability.key}>
                            <SettingsRowLabel>
                              <SettingsRowTitle>
                                {capability.label}
                              </SettingsRowTitle>
                              <SettingsRowDescription>
                                {capability.description}
                              </SettingsRowDescription>
                              {capability.conditionNote ? (
                                <span className="text-xs text-muted-foreground">
                                  {capability.conditionNote}
                                </span>
                              ) : null}
                            </SettingsRowLabel>
                            <Badge variant="outline">
                              {capabilityDirectionConfig[direction].label}
                            </Badge>
                          </SettingsRow>
                        ))}
                      </SettingsCard>
                    </div>
                  ),
                )
              ) : (
                <SettingsCard>
                  <SettingsRow>
                    <SettingsRowLabel>
                      <SettingsRowTitle>
                        No capabilities listed
                      </SettingsRowTitle>
                      <SettingsRowDescription>
                        Otto has no Slack-specific capabilities to show yet.
                      </SettingsRowDescription>
                    </SettingsRowLabel>
                  </SettingsRow>
                </SettingsCard>
              )}
            </div>
          </SettingsPage>
        </TabsContent>
      </Tabs>

      {hasChanges ? (
        <SettingsPage className="mx-0 max-w-2xl">
          <SaveBar
            hasChanges={hasChanges}
            isPending={isPending}
            onReset={resetDraft}
            onSave={saveDraft}
          />
        </SettingsPage>
      ) : null}

      <Dialog open={isDangerDialogOpen} onOpenChange={setIsDangerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm a narrower Slack setup</DialogTitle>
            <DialogDescription>
              These changes would limit who can reach Otto in Slack. Review them
              before you save.
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
  );
}

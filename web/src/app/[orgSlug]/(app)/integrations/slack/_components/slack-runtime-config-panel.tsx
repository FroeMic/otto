"use client";

import { useRouter } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  deriveSlackPolicyEffects,
  isSlackPolicyDestructive,
} from "@/tools/slack/policy";

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
    wouldDisableChannelReplies?: boolean;
    wouldDisableDMs?: boolean;
    warnings?: string[];
    wouldFullyLockOutSlack?: boolean;
  };
  key: string;
  kind: string;
  label: string;
};

type SelectedDirectoryEntry = SlackDirectoryOption & {
  isMissing?: boolean;
};

type DirectoryDialogProps = {
  availableOptions: SlackDirectoryOption[];
  channelAccessMode?: "manual_allowlist" | "member_of_channels";
  emptyMessage: string;
  kind: "channel" | "user";
  onApply: (nextSelectedIds: string[]) => void;
  onChannelMembershipChanged?: (
    channelId: string,
    action: "join" | "leave",
  ) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  orgSlug: string;
  searchPlaceholder: string;
  selectedIds: string[];
  showArchivedFilter?: boolean;
  title: string;
};

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
    return "All channels Otto is added to";
  }

  return "Only pre-configured channels";
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

function matchesDirectoryQuery(option: SlackDirectoryOption, query: string) {
  if (!query) {
    return true;
  }

  return [option.label, option.secondaryLabel, option.description]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(query));
}

function getSelectedDirectoryEntries(
  availableOptions: SlackDirectoryOption[],
  selectedIds: string[],
) {
  const optionMap = new Map(
    availableOptions.map((option) => [option.id, option]),
  );

  return selectedIds.map((id) => {
    const option = optionMap.get(id);

    return option
      ? option
      : {
          description: "This saved ID is not present in the latest Slack sync.",
          id,
          isMissing: true,
          label: id,
          secondaryLabel: "Unavailable in current directory",
        };
  });
}

function getJoinedChannelEntries(availableOptions: SlackDirectoryOption[]) {
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
      label: "Invite from Slack",
    } as const;
  }

  return {
    action: "join",
    disabled: false,
    label: "Add Otto",
  } as const;
}

function sortDirectoryOptions(
  options: SlackDirectoryOption[],
  selectedIds: Set<string>,
) {
  return [...options].sort((left, right) => {
    const leftSelected = selectedIds.has(left.id);
    const rightSelected = selectedIds.has(right.id);

    if (leftSelected !== rightSelected) {
      return leftSelected ? -1 : 1;
    }

    if (Boolean(left.isArchived) !== Boolean(right.isArchived)) {
      return left.isArchived ? 1 : -1;
    }

    return left.label.localeCompare(right.label);
  });
}

function DirectoryIdentity(props: {
  kind: "channel" | "user";
  option: SelectedDirectoryEntry;
}) {
  const { kind, option } = props;
  const secondaryText = option.secondaryLabel ?? option.description;
  const channelMetaBadges =
    kind === "channel" && !option.isMissing
      ? [
          option.visibility ? (
            <Badge key="visibility" variant="outline">
              {option.visibility === "private" ? "Private" : "Public"}
            </Badge>
          ) : null,
          option.memberCount !== null && option.memberCount !== undefined ? (
            <Badge key="members" variant="outline">
              {option.memberCount} member
              {option.memberCount === 1 ? "" : "s"}
            </Badge>
          ) : null,
          <Badge key="archived" variant="outline">
            {option.isArchived ? "Archived" : "Active"}
          </Badge>,
        ].filter(Boolean)
      : [];

  return (
    <div className="flex min-w-0 items-start gap-3">
      {kind === "user" ? (
        <Avatar size="sm">
          <AvatarFallback>{getInitials(option.label)}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex size-6 shrink-0 items-center justify-center border bg-muted text-xs font-medium text-muted-foreground">
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
          {channelMetaBadges}
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

function SelectedDirectoryList(props: {
  emptyDescription: string;
  emptyTitle: string;
  entries: SelectedDirectoryEntry[];
  kind: "channel" | "user";
}) {
  const { emptyDescription, emptyTitle, entries, kind } = props;

  if (entries.length === 0) {
    return (
      <Alert>
        <AlertTitle>{emptyTitle}</AlertTitle>
        <AlertDescription>{emptyDescription}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col border">
      {entries.map((entry, index) => (
        <div className="flex flex-col gap-4 px-4 py-3" key={entry.id}>
          <DirectoryIdentity kind={kind} option={entry} />
          {index < entries.length - 1 ? <Separator /> : null}
        </div>
      ))}
    </div>
  );
}

function DirectorySelectionDialog(props: DirectoryDialogProps) {
  const {
    availableOptions,
    channelAccessMode = "manual_allowlist",
    emptyMessage,
    kind,
    onApply,
    onChannelMembershipChanged,
    onOpenChange,
    open,
    orgSlug: _orgSlug,
    selectedIds,
    searchPlaceholder,
    showArchivedFilter = false,
    title,
  } = props;
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [workingSelectedIds, setWorkingSelectedIds] = useState(selectedIds);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [pendingMembershipAction, setPendingMembershipAction] = useState<{
    action: "join" | "leave";
    channelId: string;
  } | null>(null);
  const deferredQuery = useDeferredValue(query);
  const isChannelMembershipMode =
    kind === "channel" && channelAccessMode === "member_of_channels";

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setShowArchived(false);
    setWorkingSelectedIds(selectedIds);
    setMembershipError(null);
    setPendingMembershipAction(null);
  }, [open, selectedIds]);

  const initialSelectedIdSet = useMemo(
    () => new Set(selectedIds),
    [selectedIds],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return sortDirectoryOptions(availableOptions, initialSelectedIdSet).filter(
      (option) => {
        if (showArchivedFilter && option.isArchived && !showArchived) {
          return false;
        }

        return matchesDirectoryQuery(option, normalizedQuery);
      },
    );
  }, [
    availableOptions,
    deferredQuery,
    initialSelectedIdSet,
    showArchived,
    showArchivedFilter,
  ]);

  function toggleSelection(optionId: string) {
    setWorkingSelectedIds((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    );
  }

  function handleApply() {
    onApply(workingSelectedIds);
    onOpenChange(false);
  }

  async function handleChannelMembershipChange(
    channelId: string,
    action: "join" | "leave",
  ) {
    if (!onChannelMembershipChanged) {
      return;
    }

    setMembershipError(null);
    setPendingMembershipAction({
      action,
      channelId,
    });

    try {
      await onChannelMembershipChanged(channelId, action);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {kind === "user"
              ? "Search the synced Slack directory and choose which people stay in the allowlist."
              : isChannelMembershipMode
                ? "Search the synced Slack directory and manage which channels Otto is currently in."
                : "Search the synced Slack directory, add Otto to public channels, and choose which channels stay in Otto's manual allowlist."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 pb-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${kind}-directory-search`}>
                Search {kind === "user" ? "users" : "channels"}
              </FieldLabel>
              <Input
                id={`${kind}-directory-search`}
                placeholder={searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Field>
            {showArchivedFilter ? (
              <Field orientation="responsive">
                <FieldContent>
                  <FieldLabel htmlFor="show-archived-channels">
                    Show archived channels
                  </FieldLabel>
                  <FieldDescription>
                    Archived channels stay hidden by default.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  checked={showArchived}
                  id="show-archived-channels"
                  onCheckedChange={setShowArchived}
                />
              </Field>
            ) : null}
          </FieldGroup>

          {membershipError ? (
            <Alert variant="destructive">
              <AlertTitle>Slack channel update failed</AlertTitle>
              <AlertDescription>{membershipError}</AlertDescription>
            </Alert>
          ) : null}

          {kind === "channel" ? (
            <Alert>
              <AlertTitle>
                {isChannelMembershipMode
                  ? "Otto is allowed in every channel it is currently in."
                  : "A channel must include Otto in Slack before Otto can respond there."}
              </AlertTitle>
              <AlertDescription>
                {isChannelMembershipMode
                  ? "Use the actions in this dialog to add Otto to public channels or remove it from channels it should leave."
                  : "Use the row actions to add or remove Otto from public channels. Private channels still need a human to invite Otto from Slack."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {isChannelMembershipMode
                ? getJoinedChannelEntries(availableOptions).length
                : workingSelectedIds.length}{" "}
              {isChannelMembershipMode ? "joined" : "selected"}
            </Badge>
            <Badge variant="outline">{availableOptions.length} available</Badge>
          </div>

          <ScrollArea className="h-[24rem] border">
            <div className="flex flex-col">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => (
                  <div
                    className="flex flex-col gap-3 px-4 py-3 hover:bg-muted/40"
                    key={option.id}
                  >
                    <div className="flex items-start gap-3">
                      {kind === "user" || !isChannelMembershipMode ? (
                        <label
                          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"
                          htmlFor={`${kind}-${option.id}`}
                        >
                          <Checkbox
                            checked={workingSelectedIds.includes(option.id)}
                            id={`${kind}-${option.id}`}
                            onCheckedChange={() => toggleSelection(option.id)}
                          />
                          <DirectoryIdentity kind={kind} option={option} />
                        </label>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <DirectoryIdentity kind={kind} option={option} />
                        </div>
                      )}

                      {kind === "channel" ? (
                        <div className="shrink-0">
                          <Button
                            disabled={
                              pendingMembershipAction !== null ||
                              getChannelMembershipAction(option).disabled
                            }
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const membershipAction =
                                getChannelMembershipAction(option);

                              if (!membershipAction.action) {
                                return;
                              }

                              void handleChannelMembershipChange(
                                option.id,
                                membershipAction.action,
                              );
                            }}
                          >
                            {pendingMembershipAction?.channelId === option.id
                              ? pendingMembershipAction.action === "join"
                                ? "Adding..."
                                : "Removing..."
                              : getChannelMembershipAction(option).label}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {index < filteredOptions.length - 1 ? <Separator /> : null}
                  </div>
                ))
              ) : (
                <div className="p-4">
                  <Alert>
                    <AlertTitle>No matches</AlertTitle>
                    <AlertDescription>{emptyMessage}</AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <p className="text-xs text-muted-foreground">
            {kind === "channel"
              ? isChannelMembershipMode
                ? "Slack channel membership updates apply immediately."
                : "Slack channel membership updates apply immediately. Manual allowlist changes still wait for save."
              : "Changes stay local until you save the Slack settings page."}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={isChannelMembershipMode}
              type="button"
              onClick={handleApply}
            >
              {isChannelMembershipMode
                ? "Automatic in this mode"
                : "Apply changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsSection(props: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  const { action, children, description, title } = props;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-medium text-foreground">{title}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SlackRuntimeConfigPanel(props: {
  initialSurface: SlackRuntimeConfigSurface;
  orgSlug: string;
}) {
  const router = useRouter();
  const [surface, setSurface] = useState(props.initialSurface);
  const [draft, setDraft] = useState(props.initialSurface.config);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false);
  const [isChannelsDialogOpen, setIsChannelsDialogOpen] = useState(false);
  const [isDangerDialogOpen, setIsDangerDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasChanges = !areConfigsEqual(draft, surface.config);
  const draftEffects = useMemo(
    () =>
      deriveSlackPolicyEffects({
        config: draft,
        currentConfig: surface.config,
        directoryChannels: surface.availableChannels.map((channel) => ({
          id: channel.id,
          isArchived: channel.isArchived,
          isMember: channel.isMember,
        })),
      }),
    [draft, surface.availableChannels, surface.config],
  );
  const requiresDestructiveConfirmation = isSlackPolicyDestructive(draftEffects);
  const selectedUsers = useMemo(
    () =>
      getSelectedDirectoryEntries(surface.availableUsers, draft.allowedUserIds),
    [draft.allowedUserIds, surface.availableUsers],
  );
  const joinedChannels = useMemo(
    () => getJoinedChannelEntries(surface.availableChannels),
    [surface.availableChannels],
  );
  const selectedChannels = useMemo(
    () =>
      draft.channelAccessMode === "member_of_channels"
        ? joinedChannels
        : getSelectedDirectoryEntries(
            surface.availableChannels,
            draft.allowedChannelIds,
          ),
    [
      draft.allowedChannelIds,
      draft.channelAccessMode,
      joinedChannels,
      surface.availableChannels,
    ],
  );

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
          "You have unsaved Slack settings. Leave this page without saving?",
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

  function resetDraft() {
    setDraft(surface.config);
    setErrorMessage(null);
    setIsDangerDialogOpen(false);
    setSuccessMessage(null);
  }

  function updateBooleanSetting(
    key: "ackReactionEnabled" | "answerInThreads" | "requireMentionInChannels",
    value: boolean,
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
    setSuccessMessage(null);
  }

  function updateChannelAccessMode(
    value: "manual_allowlist" | "member_of_channels",
  ) {
    setDraft((current) => ({
      ...current,
      channelAccessMode: value,
    }));
    setSuccessMessage(null);
  }

  async function changeChannelMembership(
    channelId: string,
    action: "join" | "leave",
  ) {
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

    const updatedSurface = payload.surface;

    setSurface((current) => ({
      ...current,
      availableChannels: updatedSurface.availableChannels,
    }));
    router.refresh();
  }

  function submitDraft(options?: { allowDestructiveChanges?: boolean }) {
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
          "Slack settings saved. Otto will pick them up shortly.",
        );
        router.refresh();
      })();
    });
  }

  function saveDraft() {
    if (requiresDestructiveConfirmation) {
      setIsDangerDialogOpen(true);
      return;
    }

    submitDraft();
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <Card>
        <CardContent className="flex flex-col gap-8 pt-6">
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
            <Alert>
              <AlertTitle>Review Slack reachability changes</AlertTitle>
              <AlertDescription>
                <ul className="flex list-disc flex-col gap-1 pl-4">
                  {draftEffects.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <SettingsSection
            description="Configure Otto's default Slack behavior while it is processing and replying."
            title="General Config"
          >
            <FieldGroup>
              <Field orientation="responsive">
                <FieldContent>
                  <FieldLabel htmlFor="slack-ack-reaction">
                    Ack reaction
                  </FieldLabel>
                  <FieldDescription>
                    Add a fixed Slack acknowledgement reaction while Otto is
                    processing an inbound message.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  checked={draft.ackReactionEnabled}
                  id="slack-ack-reaction"
                  onCheckedChange={(checked) =>
                    updateBooleanSetting("ackReactionEnabled", checked)
                  }
                />
              </Field>
              <Field orientation="responsive">
                <FieldContent>
                  <FieldLabel htmlFor="slack-answer-in-threads">
                    Answer in threads
                  </FieldLabel>
                  <FieldDescription>
                    Keep Otto replies inside Slack threads for channel
                    conversations.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  checked={draft.answerInThreads}
                  id="slack-answer-in-threads"
                  onCheckedChange={(checked) =>
                    updateBooleanSetting("answerInThreads", checked)
                  }
                />
              </Field>
            </FieldGroup>
          </SettingsSection>

          <Separator />

          <SettingsSection
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUsersDialogOpen(true)}
              >
                Manage users
              </Button>
            }
            description="This global allowlist controls who can write with Otto in Slack."
            title="User Permissions"
          >
            <SelectedDirectoryList
              emptyDescription="Otto will ignore messages from people outside this allowlist."
              emptyTitle="No users are white-listed yet"
              entries={selectedUsers}
              kind="user"
            />
          </SettingsSection>

          <Separator />

          <SettingsSection
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsChannelsDialogOpen(true)}
              >
                Manage channels
              </Button>
            }
            description={
              draft.channelAccessMode === "member_of_channels"
                ? "Manage channel gating and Otto's current Slack channel membership."
                : "Manage mention requirements, choose how channel access works, and configure the relevant channel list."
            }
            title="Channels"
          >
            <div className="flex flex-col gap-6">
              <FieldGroup>
                <Field orientation="responsive">
                  <FieldContent>
                    <FieldLabel htmlFor="slack-require-mention">
                      Require mentions
                    </FieldLabel>
                    <FieldDescription>
                      When enabled, Otto only responds in channels after an
                      explicit mention.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    checked={draft.requireMentionInChannels}
                    id="slack-require-mention"
                    onCheckedChange={(checked) =>
                      updateBooleanSetting("requireMentionInChannels", checked)
                    }
                  />
                </Field>

                <Field orientation="responsive">
                  <FieldContent className="gap-3">
                    <FieldLabel htmlFor="slack-channel-access-mode">
                      Channel access mode
                    </FieldLabel>
                    <FieldDescription>
                      {draft.channelAccessMode === "member_of_channels"
                        ? "Otto is allowed in every Slack channel it is currently a member of."
                        : "Otto only works in channels that are both selected here and include Otto in Slack."}
                    </FieldDescription>
                  </FieldContent>
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
                    <SelectTrigger
                      className="w-full text-sm @md/field-group:w-[22rem]"
                      id="slack-channel-access-mode"
                    >
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
                    <SelectContent
                      align="start"
                      className="min-w-[24rem] @md/field-group:min-w-[28rem]"
                    >
                      <SelectItem value="manual_allowlist">
                        Only pre-configured channels
                      </SelectItem>
                      <SelectItem value="member_of_channels">
                        All channels Otto is added to
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>

              {draft.channelAccessMode === "manual_allowlist" ? (
                <SelectedDirectoryList
                  emptyDescription="Otto stays out of channels until you add at least one allowed channel here."
                  emptyTitle="No channels are allowed yet"
                  entries={selectedChannels}
                  kind="channel"
                />
              ) : (
                <SelectedDirectoryList
                  emptyDescription="Otto is not in any Slack channels yet. Add Otto to a public channel here or invite it from Slack."
                  emptyTitle="Otto is not in any channels yet"
                  entries={selectedChannels}
                  kind="channel"
                />
              )}
            </div>
          </SettingsSection>
        </CardContent>
      </Card>

      <DirectorySelectionDialog
        availableOptions={surface.availableUsers}
        emptyMessage="No Slack users match the current filter."
        kind="user"
        open={isUsersDialogOpen}
        orgSlug={props.orgSlug}
        searchPlaceholder="Filter by name or @username"
        selectedIds={draft.allowedUserIds}
        title="Manage allowed users"
        onApply={(allowedUserIds) => {
          setDraft((current) => ({
            ...current,
            allowedUserIds,
          }));
          setSuccessMessage(null);
        }}
        onOpenChange={setIsUsersDialogOpen}
      />

      <DirectorySelectionDialog
        availableOptions={surface.availableChannels}
        emptyMessage="No Slack channels match the current filter."
        channelAccessMode={draft.channelAccessMode}
        kind="channel"
        open={isChannelsDialogOpen}
        orgSlug={props.orgSlug}
        searchPlaceholder="Filter by channel name"
        selectedIds={draft.allowedChannelIds}
        showArchivedFilter
        title="Manage allowed channels"
        onChannelMembershipChanged={changeChannelMembership}
        onApply={(allowedChannelIds) => {
          setDraft((current) => ({
            ...current,
            allowedChannelIds,
          }));
          setSuccessMessage(null);
        }}
        onOpenChange={setIsChannelsDialogOpen}
      />

      <Dialog open={isDangerDialogOpen} onOpenChange={setIsDangerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm destructive Slack change</DialogTitle>
            <DialogDescription>
              This change will reduce how people can reach Otto in Slack. Otto
              blocks these changes for agents, and the dashboard requires an
              explicit confirmation before saving them.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 pb-5">
            <Alert variant="destructive">
              <AlertTitle>Slack reachability will be reduced</AlertTitle>
              <AlertDescription>
                <ul className="flex list-disc flex-col gap-1 pl-4">
                  {draftEffects.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDangerDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              type="button"
              variant="destructive"
              onClick={() =>
                submitDraft({
                  allowDestructiveChanges: true,
                })
              }
            >
              {isPending ? "Saving..." : "Save anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasChanges ? (
        <div className="sticky bottom-4 z-20">
          <div className="flex flex-col gap-3 border bg-background/95 p-4 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/85 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                You have unsaved Slack settings.
              </p>
              <p className="text-xs text-muted-foreground">
                Review the changes, then save to queue a runtime apply.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                disabled={isPending}
                type="button"
                variant="outline"
                onClick={resetDraft}
              >
                Discard
              </Button>
              <Button disabled={isPending} type="button" onClick={saveDraft}>
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

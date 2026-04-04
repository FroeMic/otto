"use client";

import { PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getLocaleOptions,
  getTimeFormatPreferenceOptions,
  getTimeZoneOptions,
  normalizeLocale,
  normalizeTimeFormatPreference,
  normalizeTimeZone,
  type WorkspaceDateTimePreferences,
  type WorkspaceTimeFormatPreference,
} from "@/lib/date-time";

const LOCALE_OPTIONS = getLocaleOptions();
const TIME_ZONE_OPTIONS = getTimeZoneOptions();
const TIME_FORMAT_OPTIONS = getTimeFormatPreferenceOptions();

type WorkspaceDetailsCardProps = {
  orgSlug: string;
  organization: {
    name: string;
    slug: string;
  };
};

export function WorkspaceDetailsCard({
  orgSlug,
  organization,
}: WorkspaceDetailsCardProps) {
  return (
    <SettingsCard>
      <WorkspaceNameRow orgSlug={orgSlug} initialName={organization.name} />
      <WorkspaceSlugRow orgSlug={orgSlug} initialSlug={organization.slug} />
    </SettingsCard>
  );
}

export function WorkspaceTimeAndRegionCard({
  orgSlug,
  initialPreferences,
}: {
  orgSlug: string;
  initialPreferences: WorkspaceDateTimePreferences;
}) {
  const router = useRouter();
  const [preferences, setPreferences] = useState<WorkspaceDateTimePreferences>({
    locale: normalizeLocale(initialPreferences.locale),
    timeFormatPreference: normalizeTimeFormatPreference(
      initialPreferences.timeFormatPreference,
    ),
    timeZone: normalizeTimeZone(initialPreferences.timeZone),
  });
  const [savedPreferences, setSavedPreferences] =
    useState<WorkspaceDateTimePreferences>({
      locale: normalizeLocale(initialPreferences.locale),
      timeFormatPreference: normalizeTimeFormatPreference(
        initialPreferences.timeFormatPreference,
      ),
      timeZone: normalizeTimeZone(initialPreferences.timeZone),
    });
  const [isPending, startTransition] = useTransition();

  function updatePreference<Key extends keyof WorkspaceDateTimePreferences>(
    key: Key,
    value: WorkspaceDateTimePreferences[Key],
    action: "update-locale" | "update-time-format" | "update-timezone",
  ) {
    const previousPreferences = savedPreferences;
    const nextPreferences = {
      ...preferences,
      [key]: value,
    };

    if (nextPreferences[key] === savedPreferences[key]) {
      return;
    }

    setPreferences(nextPreferences);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/workspace/${orgSlug}/settings`, {
          body: JSON.stringify(
            action === "update-locale"
              ? {
                  action,
                  locale: value,
                }
              : action === "update-time-format"
                ? {
                    action,
                    timeFormatPreference: value,
                  }
                : {
                    action,
                    timezone: value,
                  },
          ),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message ?? "Something went wrong");
        }

        const nextSavedPreferences = {
          locale: normalizeLocale(data.locale),
          timeFormatPreference: normalizeTimeFormatPreference(
            data.timeFormatPreference,
          ),
          timeZone: normalizeTimeZone(data.timezone),
        } satisfies WorkspaceDateTimePreferences;

        setSavedPreferences(nextSavedPreferences);
        setPreferences(nextSavedPreferences);
        router.refresh();
        toast.success(
          data.applyQueued
            ? "Workspace time settings updated. Otto is applying the change."
            : "Workspace time settings updated",
        );
      } catch (error) {
        setPreferences(previousPreferences);
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <SettingsCard>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Timezone</SettingsRowTitle>
          <SettingsRowDescription>
            Used for the tenant runtime, scheduled task interpretation, and
            workspace dates.
          </SettingsRowDescription>
        </SettingsRowLabel>
        <Select
          disabled={isPending}
          value={preferences.timeZone}
          onValueChange={(nextTimeZone) => {
            if (!nextTimeZone) {
              return;
            }

            updatePreference("timeZone", nextTimeZone, "update-timezone");
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" className="max-h-96">
            <SelectGroup>
              {TIME_ZONE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Language and region</SettingsRowTitle>
          <SettingsRowDescription>
            Controls locale-aware date labels across the workspace.
          </SettingsRowDescription>
        </SettingsRowLabel>
        <Select
          disabled={isPending}
          value={preferences.locale}
          onValueChange={(nextLocale) => {
            if (!nextLocale) {
              return;
            }

            updatePreference("locale", nextLocale, "update-locale");
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {LOCALE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Time format</SettingsRowTitle>
          <SettingsRowDescription>
            Controls whether times render automatically, in 12-hour, or in
            24-hour format.
          </SettingsRowDescription>
        </SettingsRowLabel>
        <Select
          disabled={isPending}
          value={preferences.timeFormatPreference}
          onValueChange={(nextTimeFormatPreference) => {
            if (!nextTimeFormatPreference) {
              return;
            }

            updatePreference(
              "timeFormatPreference",
              nextTimeFormatPreference as WorkspaceTimeFormatPreference,
              "update-time-format",
            );
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {TIME_FORMAT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </SettingsRow>
    </SettingsCard>
  );
}

// ── Name row (debounced auto-save with toast) ───────────────────────────────

function WorkspaceNameRow({
  orgSlug,
  initialName,
}: {
  orgSlug: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialName);

  const saveName = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === lastSavedRef.current) return;

      try {
        const res = await fetch(`/api/workspace/${orgSlug}/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update-name", name: trimmed }),
        });

        if (res.ok) {
          lastSavedRef.current = trimmed;
          toast.success("Workspace name updated");
        }
      } catch {
        // silently fail — user can retry
      }
    },
    [orgSlug],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveName(name), 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, saveName]);

  return (
    <SettingsRow>
      <SettingsRowLabel>
        <SettingsRowTitle>Name</SettingsRowTitle>
      </SettingsRowLabel>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-56 shrink-0"
      />
    </SettingsRow>
  );
}

// ── Slug row (text + pencil button → dialog) ────────────────────────────────

function WorkspaceSlugRow({
  orgSlug,
  initialSlug,
}: {
  orgSlug: string;
  initialSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(initialSlug);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setSlug(initialSlug);
      setError(null);
    }
  }

  function handleUpdate() {
    const normalized = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!normalized) {
      setError("URL is required");
      return;
    }

    if (normalized === initialSlug) {
      setOpen(false);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/workspace/${orgSlug}/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update-slug", slug: normalized }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message ?? "Something went wrong");
          return;
        }

        setOpen(false);
        router.push(`/${normalized}/settings/workspace`);
      } catch {
        setError("Something went wrong");
      }
    });
  }

  return (
    <SettingsRow>
      <SettingsRowLabel>
        <SettingsRowTitle>URL</SettingsRowTitle>
      </SettingsRowLabel>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">
          getyourotto.com/{initialSlug}
        </span>
        <button
          type="button"
          onClick={() => handleOpenChange(true)}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon
            icon={PencilEdit01Icon}
            className="size-4"
            strokeWidth={1.5}
          />
        </button>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Change workspace URL</DialogTitle>
              <DialogDescription>
                This will change all your URLs. Existing links will stop
                working.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <label htmlFor="workspace-slug" className="text-sm font-medium">
                Enter the new workspace URL
              </label>
              <div className="flex items-center">
                <span className="flex h-9 shrink-0 items-center pr-1 text-sm text-muted-foreground">
                  getyourotto.com/
                </span>
                <Input
                  id="workspace-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isPending || !slug.trim()}
              >
                {isPending ? "Updating…" : "Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsRow>
  );
}

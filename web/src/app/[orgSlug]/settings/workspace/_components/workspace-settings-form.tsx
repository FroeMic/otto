"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  SettingsCard,
  SettingsRow,
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

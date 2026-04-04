"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, useTransition } from "react";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const THEME_OPTIONS = [
  { label: "System preference", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const;

// ── Theme card ──────────────────────────────────────────────────────────────

export function ThemeSettingsCard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SettingsCard>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Interface theme</SettingsRowTitle>
          <SettingsRowDescription>
            Choose how Otto looks for you
          </SettingsRowDescription>
        </SettingsRowLabel>
        {mounted ? (
          <Select
            value={theme ?? "system"}
            onValueChange={(value) => {
              if (value) setTheme(value);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {THEME_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="h-9 w-44 animate-pulse rounded-3xl bg-input/50" />
        )}
      </SettingsRow>
    </SettingsCard>
  );
}

// ── Account details card ────────────────────────────────────────────────────

type AccountDetailsCardProps = {
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
};

export function AccountDetailsCard({ user }: AccountDetailsCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setError(null);
    }
  }

  function handleSave() {
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/user/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message ?? "Something went wrong");
          return;
        }

        setOpen(false);
        router.refresh();
      } catch {
        setError("Something went wrong");
      }
    });
  }

  return (
    <SettingsCard>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Name</SettingsRowTitle>
        </SettingsRowLabel>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{displayName}</span>
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              Edit
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit name</DialogTitle>
                <DialogDescription>
                  This name is visible to other members in your workspace.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="firstName" className="text-sm font-medium">
                    First name
                  </label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="lastName" className="text-sm font-medium">
                    Last name
                  </label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <DialogFooter>
                <Button
                  onClick={handleSave}
                  disabled={isPending || !firstName.trim()}
                >
                  {isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Email</SettingsRowTitle>
        </SettingsRowLabel>
        <span className="text-sm text-muted-foreground">{user.email}</span>
      </SettingsRow>
    </SettingsCard>
  );
}

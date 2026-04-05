"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getAutoTopOffPacks } from "@/lib/billing/plans";

type BillingPreferences = {
  autoTopOffEnabled: boolean;
  minimumBalanceCredits: number;
  monthlySpendLimitCents: number;
  topOffAmountCents: number;
};

type WorkspaceBillingPreferencesCardProps = {
  initialPreferences: BillingPreferences;
  locale: string;
  orgSlug: string;
};

type WorkspaceSpendLimitCardProps = {
  currentCycleSpendCents: number;
  initialPreferences: BillingPreferences;
  locale: string;
  orgSlug: string;
};

function formatUsd(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatCredits(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

export function WorkspaceBillingPreferencesCard({
  initialPreferences,
  locale,
  orgSlug,
}: WorkspaceBillingPreferencesCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const packs = useMemo(() => getAutoTopOffPacks(), []);
  const [prefs, setPrefs] = useState(initialPreferences);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPack = packs.find(
    (p) => p.amountCents === prefs.topOffAmountCents,
  );

  const save = useCallback(
    (next: BillingPreferences) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        startTransition(async () => {
          try {
            const response = await fetch(
              `/api/workspace/${orgSlug}/billing/preferences`,
              {
                body: JSON.stringify(next),
                headers: { "Content-Type": "application/json" },
                method: "POST",
              },
            );

            const body = (await response.json().catch(() => null)) as {
              fieldErrors?: Record<string, string[] | undefined>;
              message?: string;
            } | null;

            if (!response.ok) {
              const firstFieldError = body?.fieldErrors
                ? Object.values(body.fieldErrors).flat().find(Boolean)
                : null;
              throw new Error(
                firstFieldError ??
                  body?.message ??
                  "Failed to save billing settings.",
              );
            }

            router.refresh();
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to save billing settings.",
            );
          }
        });
      }, 600);
    },
    [orgSlug, router, startTransition],
  );

  function update(patch: Partial<BillingPreferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    save(next);
  }

  const fieldsDisabled = isPending || !prefs.autoTopOffEnabled;

  return (
    <>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Auto-reload</SettingsRowTitle>
          <SettingsRowDescription>
            Automatically add credits when your balance is low.
          </SettingsRowDescription>
        </SettingsRowLabel>
        <Switch
          checked={prefs.autoTopOffEnabled}
          disabled={isPending}
          onCheckedChange={(checked) =>
            update({ autoTopOffEnabled: checked })
          }
        />
      </SettingsRow>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Minimum balance</SettingsRowTitle>
          <SettingsRowDescription>
            Reload triggers at this credit level.
          </SettingsRowDescription>
        </SettingsRowLabel>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Credits</span>
          <Input
            className="w-28 text-right"
            disabled={fieldsDisabled}
            inputMode="numeric"
            min={0}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(val) && val >= 0)
                update({ minimumBalanceCredits: val });
            }}
            type="number"
            value={prefs.minimumBalanceCredits}
          />
        </div>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Reload amount</SettingsRowTitle>
          <SettingsRowDescription>
            Credits added each time auto-reload triggers.
          </SettingsRowDescription>
        </SettingsRowLabel>
        <Select
          disabled={fieldsDisabled}
          onValueChange={(value) => {
            if (value) update({ topOffAmountCents: Number(value) });
          }}
          value={String(prefs.topOffAmountCents)}
        >
          <SelectTrigger className="w-52">
            <SelectValue>
              {selectedPack
                ? `${formatUsd(selectedPack.amountCents / 100, locale)} · ${formatCredits(selectedPack.creditsGranted, locale)} credits`
                : "Select pack"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {packs.map((pack) => (
                <SelectItem
                  key={pack.amountCents}
                  value={String(pack.amountCents)}
                >
                  <span className="flex items-center gap-1.5">
                    {formatUsd(pack.amountCents / 100, locale)} ·{" "}
                    {formatCredits(pack.creditsGranted, locale)} credits
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </SettingsRow>
    </>
  );
}

export function WorkspaceSpendLimitCard({
  currentCycleSpendCents,
  initialPreferences,
  locale,
  orgSlug,
}: WorkspaceSpendLimitCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const packs = useMemo(() => getAutoTopOffPacks(), []);
  const [spendLimitUsd, setSpendLimitUsd] = useState(
    initialPreferences.monthlySpendLimitCents / 100,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPack = packs.find(
    (p) => p.amountCents === initialPreferences.topOffAmountCents,
  );
  const nextReloadCents = selectedPack?.amountCents ?? 0;
  const wouldExceedLimit =
    initialPreferences.autoTopOffEnabled &&
    spendLimitUsd > 0 &&
    currentCycleSpendCents + nextReloadCents > spendLimitUsd * 100;

  function handleChange(value: number) {
    setSpendLimitUsd(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const response = await fetch(
            `/api/workspace/${orgSlug}/billing/preferences`,
            {
              body: JSON.stringify({
                ...initialPreferences,
                monthlySpendLimitCents: value * 100,
              }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            },
          );

          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as {
              message?: string;
            } | null;
            throw new Error(body?.message ?? "Failed to save spend limit.");
          }

          router.refresh();
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to save spend limit.",
          );
        }
      });
    }, 600);
  }

  return (
    <>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Billing cycle spend limit</SettingsRowTitle>
          <SettingsRowDescription>
            Auto-reload pauses after this amount (incl. tax) is spent in a
            billing cycle.
          </SettingsRowDescription>
        </SettingsRowLabel>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">$</span>
          <Input
            className="w-24 text-right"
            disabled={isPending}
            inputMode="numeric"
            min={0}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(val) && val >= 0) handleChange(val);
            }}
            type="number"
            value={spendLimitUsd}
          />
        </div>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Current cycle spend</SettingsRowTitle>
          <SettingsRowDescription>
            {formatUsd(currentCycleSpendCents / 100, locale)} of{" "}
            {spendLimitUsd > 0
              ? `${formatUsd(spendLimitUsd, locale)} limit`
              : "no limit set"}
          </SettingsRowDescription>
        </SettingsRowLabel>
        {wouldExceedLimit ? (
          <span className="text-xs text-muted-foreground">
            Next auto-reload will be blocked
          </span>
        ) : null}
      </SettingsRow>
    </>
  );
}

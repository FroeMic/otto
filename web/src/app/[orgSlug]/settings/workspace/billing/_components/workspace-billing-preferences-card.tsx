"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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

function formatCredits(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatUsd(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function WorkspaceBillingPreferencesCard({
  initialPreferences,
  locale,
  orgSlug,
}: WorkspaceBillingPreferencesCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const packs = useMemo(() => getAutoTopOffPacks(), []);
  const [autoTopOffEnabled, setAutoTopOffEnabled] = useState(
    initialPreferences.autoTopOffEnabled,
  );
  const [minimumBalanceCredits, setMinimumBalanceCredits] = useState(
    String(initialPreferences.minimumBalanceCredits),
  );
  const [monthlySpendLimitUsd, setMonthlySpendLimitUsd] = useState(
    String(initialPreferences.monthlySpendLimitCents / 100),
  );
  const [topOffAmountCents, setTopOffAmountCents] = useState(
    String(initialPreferences.topOffAmountCents),
  );

  const parsedMinimumBalanceCredits = Number.parseInt(
    minimumBalanceCredits,
    10,
  );
  const parsedMonthlySpendLimitUsd = Number.parseInt(monthlySpendLimitUsd, 10);
  const parsedTopOffAmountCents = Number.parseInt(topOffAmountCents, 10);
  const selectedPack =
    packs.find((pack) => pack.amountCents === parsedTopOffAmountCents) ?? null;

  const normalizedState = {
    autoTopOffEnabled,
    minimumBalanceCredits: Number.isNaN(parsedMinimumBalanceCredits)
      ? 0
      : parsedMinimumBalanceCredits,
    monthlySpendLimitCents: Number.isNaN(parsedMonthlySpendLimitUsd)
      ? 0
      : parsedMonthlySpendLimitUsd * 100,
    topOffAmountCents: Number.isNaN(parsedTopOffAmountCents)
      ? initialPreferences.topOffAmountCents
      : parsedTopOffAmountCents,
  };

  const isDirty =
    normalizedState.autoTopOffEnabled !==
      initialPreferences.autoTopOffEnabled ||
    normalizedState.minimumBalanceCredits !==
      initialPreferences.minimumBalanceCredits ||
    normalizedState.monthlySpendLimitCents !==
      initialPreferences.monthlySpendLimitCents ||
    normalizedState.topOffAmountCents !== initialPreferences.topOffAmountCents;

  const hasInvalidValues =
    Number.isNaN(parsedMinimumBalanceCredits) ||
    parsedMinimumBalanceCredits < 0 ||
    Number.isNaN(parsedMonthlySpendLimitUsd) ||
    parsedMonthlySpendLimitUsd < 0 ||
    !packs.some(
      (pack) => pack.amountCents === normalizedState.topOffAmountCents,
    );

  function handleSave() {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/workspace/${orgSlug}/billing/preferences`,
          {
            body: JSON.stringify(normalizedState),
            headers: {
              "Content-Type": "application/json",
            },
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

        toast.success("Billing settings updated.");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to save billing settings.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-6 px-5 py-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">Auto-reload</span>
          <span className="text-sm text-muted-foreground">
            Automatically add credits when your workspace reaches the minimum
            balance you set below.
          </span>
        </div>
        <Switch
          checked={autoTopOffEnabled}
          disabled={isPending}
          onCheckedChange={setAutoTopOffEnabled}
        />
      </div>

      <div className="border-t px-5 py-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="minimum-balance-credits">
              Minimum balance
            </FieldLabel>
            <FieldContent>
              <Input
                id="minimum-balance-credits"
                inputMode="numeric"
                min={0}
                onChange={(event) =>
                  setMinimumBalanceCredits(event.target.value)
                }
                type="number"
                value={minimumBalanceCredits}
              />
              <FieldDescription>
                Auto-reload starts once the workspace reaches this many credits
                or less.
              </FieldDescription>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="top-off-pack">Reload pack</FieldLabel>
            <FieldContent>
              <Select
                onValueChange={(value) => {
                  if (value) {
                    setTopOffAmountCents(value);
                  }
                }}
                value={topOffAmountCents}
              >
                <SelectTrigger className="w-full" id="top-off-pack">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectGroup>
                    {packs.map((pack) => (
                      <SelectItem
                        key={pack.amountCents}
                        value={String(pack.amountCents)}
                      >
                        {formatUsd(pack.amountCents / 100, locale)} ·{" "}
                        {formatCredits(pack.creditsGranted, locale)} credits
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                Auto-reload currently supports the fixed pack amounts from the
                plan catalog only.
              </FieldDescription>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="monthly-spend-limit">
              Monthly spend limit
            </FieldLabel>
            <FieldContent>
              <Input
                id="monthly-spend-limit"
                inputMode="numeric"
                min={0}
                onChange={(event) =>
                  setMonthlySpendLimitUsd(event.target.value)
                }
                type="number"
                value={monthlySpendLimitUsd}
              />
              <FieldDescription>
                Auto-reload pauses after this monthly spend cap is reached.
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>
      </div>

      <div className="flex flex-col gap-4 border-t px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {autoTopOffEnabled
            ? `Otto will try to add ${selectedPack ? `${formatUsd(selectedPack.amountCents / 100, locale)} (${formatCredits(selectedPack.creditsGranted, locale)} credits)` : "the selected pack"} once this workspace reaches ${formatCredits(normalizedState.minimumBalanceCredits, locale)} credits or less.`
            : "Auto-reload is currently off for this workspace."}
        </p>
        <Button
          disabled={hasInvalidValues || isPending || !isDirty}
          onClick={handleSave}
          variant="outline"
        >
          {isPending ? "Saving…" : "Save billing settings"}
        </Button>
      </div>
    </div>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import {
  billingOverviewQueryOptions,
  updateBillingPreferences,
} from "../api/billing"
import type { BillingPreferences } from "../types"

const autoTopOffPacks = [
  { amountCents: 2_000, creditsGranted: 10_000 },
  { amountCents: 5_000, creditsGranted: 30_000 },
  { amountCents: 10_000, creditsGranted: 70_000 },
  { amountCents: 20_000, creditsGranted: 150_000 },
] as const

function formatUsd(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value)
}

function formatCredits(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value)
}

export interface WorkspaceBillingPreferencesCardProps {
  initialPreferences: BillingPreferences
  latestRunFailureReason?: string | null
  latestRunStatus?: string | null
  locale: string
  orgSlug: string
}

export function WorkspaceBillingPreferencesCard({
  initialPreferences,
  latestRunFailureReason = null,
  latestRunStatus = null,
  locale,
  orgSlug,
}: WorkspaceBillingPreferencesCardProps) {
  const queryClient = useQueryClient()
  const [preferences, setPreferences] = useState(initialPreferences)
  const selectedPack = useMemo(
    () =>
      autoTopOffPacks.find(
        (pack) => pack.amountCents === preferences.topOffAmountCents,
      ),
    [preferences.topOffAmountCents],
  )
  const mutation = useMutation({
    mutationFn: async (nextPreferences: BillingPreferences) =>
      updateBillingPreferences({
        orgSlug,
        preferences: nextPreferences,
      }),
    onSuccess: async (nextPreferences) => {
      setPreferences(nextPreferences)
      await queryClient.invalidateQueries(billingOverviewQueryOptions(orgSlug))
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save billing settings.",
      )
    },
  })

  function applyPatch(patch: Partial<BillingPreferences>) {
    const nextPreferences = {
      ...preferences,
      ...patch,
    }

    setPreferences(nextPreferences)
    mutation.mutate(nextPreferences)
  }

  const fieldsDisabled = mutation.isPending || !preferences.autoTopOffEnabled

  return (
    <>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Auto-reload</SettingsRowTitle>
          <SettingsRowDescription>
            {latestRunStatus === "failed"
              ? "The last auto-reload attempt failed. Update your billing details or spend limit if needed."
              : "Automatically add credits when your balance is low."}
            {latestRunFailureReason ? ` ${latestRunFailureReason}` : ""}
          </SettingsRowDescription>
        </SettingsRowLabel>
        <Switch
          checked={preferences.autoTopOffEnabled}
          disabled={mutation.isPending}
          onCheckedChange={(checked) =>
            applyPatch({ autoTopOffEnabled: checked })
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
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10)

              if (!Number.isNaN(value) && value >= 0) {
                applyPatch({ minimumBalanceCredits: value })
              }
            }}
            type="number"
            value={preferences.minimumBalanceCredits}
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
            if (value) {
              applyPatch({ topOffAmountCents: Number(value) })
            }
          }}
          value={String(preferences.topOffAmountCents)}
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
              {autoTopOffPacks.map((pack) => (
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
  )
}

export interface WorkspaceSpendLimitCardProps {
  currentCycleSpendCents: number
  initialPreferences: BillingPreferences
  locale: string
  nextAutoReloadChargeCents: number | null
  orgSlug: string
  wouldBlockNextAutoReload: boolean
}

export function WorkspaceSpendLimitCard({
  currentCycleSpendCents,
  initialPreferences,
  locale,
  nextAutoReloadChargeCents,
  orgSlug,
  wouldBlockNextAutoReload,
}: WorkspaceSpendLimitCardProps) {
  const queryClient = useQueryClient()
  const [monthlySpendLimitUsd, setMonthlySpendLimitUsd] = useState(
    initialPreferences.monthlySpendLimitCents / 100,
  )
  const mutation = useMutation({
    mutationFn: async (nextMonthlySpendLimitUsd: number) =>
      updateBillingPreferences({
        orgSlug,
        preferences: {
          ...initialPreferences,
          monthlySpendLimitCents: nextMonthlySpendLimitUsd * 100,
        },
      }),
    onSuccess: async (nextPreferences) => {
      setMonthlySpendLimitUsd(nextPreferences.monthlySpendLimitCents / 100)
      await queryClient.invalidateQueries(billingOverviewQueryOptions(orgSlug))
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to save spend limit.",
      )
    },
  })

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
            disabled={mutation.isPending}
            inputMode="numeric"
            min={0}
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10)

              if (!Number.isNaN(value) && value >= 0) {
                setMonthlySpendLimitUsd(value)
                mutation.mutate(value)
              }
            }}
            type="number"
            value={monthlySpendLimitUsd}
          />
        </div>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Current cycle spend</SettingsRowTitle>
          <SettingsRowDescription>
            {formatUsd(currentCycleSpendCents / 100, locale)} of{" "}
            {monthlySpendLimitUsd > 0
              ? `${formatUsd(monthlySpendLimitUsd, locale)} limit`
              : "no limit set"}{" "}
            billed so far, including tax.
          </SettingsRowDescription>
        </SettingsRowLabel>
        {wouldBlockNextAutoReload ? (
          <div className="text-right text-xs text-muted-foreground">
            <div>Next auto-reload will be blocked</div>
            {nextAutoReloadChargeCents !== null ? (
              <div>
                Previewed top-up charge incl. tax:{" "}
                {formatUsd(nextAutoReloadChargeCents / 100, locale)}
              </div>
            ) : null}
          </div>
        ) : null}
      </SettingsRow>
    </>
  )
}

import { GlobeHemisphereEastIcon } from "@phosphor-icons/react/ssr"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox"
import { InputGroupAddon } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { updateWorkspaceSettings } from "@/features/workspace/api/workspace"
import {
  getGroupedTimeZoneOptions,
  getLocaleOptions,
  getTimeFormatPreferenceOptions,
  resolveWorkspaceDateTimePreferences,
  type WorkspaceDateTimePreferences,
  type WorkspaceLocaleOption,
  type WorkspaceTimeFormatPreference,
  type WorkspaceTimeZoneOption,
  type WorkspaceTimeZoneOptionGroup,
} from "@/features/workspace/date-time"

export interface WorkspaceTimeAndRegionCardProps {
  initialPreferences: WorkspaceDateTimePreferences
  orgSlug: string
}

export function WorkspaceTimeAndRegionCard({
  initialPreferences,
  orgSlug,
}: WorkspaceTimeAndRegionCardProps) {
  const queryClient = useQueryClient()
  const [preferences, setPreferences] = useState(
    resolveWorkspaceDateTimePreferences(initialPreferences),
  )
  const timeZoneGroups = useMemo(() => {
    return getGroupedTimeZoneOptions(preferences.timeZone)
  }, [preferences.timeZone])
  const timeZoneOptionLabels = useMemo(() => {
    return new Map(
      timeZoneGroups.flatMap((group) => {
        return group.items.map((item) => [item.value, item.label] as const)
      }),
    )
  }, [timeZoneGroups])
  const mutation = useMutation({
    mutationFn: async (
      input:
        | { action: "update-locale"; value: string }
        | { action: "update-time-format"; value: WorkspaceTimeFormatPreference }
        | { action: "update-timezone"; value: string },
    ) => {
      if (input.action === "update-locale") {
        return updateWorkspaceSettings(orgSlug, {
          action: "update-locale",
          locale: input.value,
        })
      }

      if (input.action === "update-time-format") {
        return updateWorkspaceSettings(orgSlug, {
          action: "update-time-format",
          timeFormatPreference: input.value,
        })
      }

      return updateWorkspaceSettings(orgSlug, {
        action: "update-timezone",
        timezone: input.value,
      })
    },
    onSuccess: async (result) => {
      if (!("timezone" in result)) {
        return
      }

      const nextPreferences = resolveWorkspaceDateTimePreferences({
        locale: result.locale,
        timeFormatPreference: result.timeFormatPreference,
        timeZone: result.timezone,
      })

      setPreferences(nextPreferences)
      await queryClient.invalidateQueries({
        queryKey: ["shell-bootstrap", orgSlug],
      })
      toast.success(
        result.applyQueued
          ? "Workspace time settings updated. Otto is applying the change."
          : "Workspace time settings updated",
      )
    },
  })

  async function updatePreference<Key extends keyof WorkspaceDateTimePreferences>(
    key: Key,
    value: WorkspaceDateTimePreferences[Key],
    action: "update-locale" | "update-time-format" | "update-timezone",
  ) {
    const previousPreferences = preferences
    const nextPreferences = {
      ...preferences,
      [key]: value,
    }

    if (nextPreferences[key] === previousPreferences[key]) {
      return
    }

    setPreferences(nextPreferences)

    try {
      await mutation.mutateAsync({
        action,
        value,
      } as
        | { action: "update-locale"; value: string }
        | { action: "update-time-format"; value: WorkspaceTimeFormatPreference }
        | { action: "update-timezone"; value: string })
    } catch (error) {
      setPreferences(previousPreferences)
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      )
    }
  }

  return (
    <SettingsCard>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Locale</SettingsRowTitle>
          <SettingsRowDescription>
            Used for browser-facing date, number, and currency formatting in
            your workspace.
          </SettingsRowDescription>
        </SettingsRowLabel>
        <Select
          disabled={mutation.isPending}
          value={preferences.locale}
          onValueChange={(nextLocale) => {
            if (!nextLocale) {
              return
            }

            void updatePreference("locale", nextLocale, "update-locale")
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {getLocaleOptions().map((option: WorkspaceLocaleOption) => (
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
          <SettingsRowTitle>Timezone</SettingsRowTitle>
          <SettingsRowDescription>
            Used for the tenant runtime, scheduled task interpretation, and
            workspace dates.
          </SettingsRowDescription>
        </SettingsRowLabel>
        <Combobox
          disabled={mutation.isPending}
          items={timeZoneGroups}
          itemToStringLabel={(timeZone) => {
            return `${timeZoneOptionLabels.get(timeZone) ?? timeZone} ${timeZone}`
          }}
          value={preferences.timeZone}
          onValueChange={(nextTimeZone) => {
            if (!nextTimeZone || typeof nextTimeZone !== "string") {
              return
            }

            void updatePreference("timeZone", nextTimeZone, "update-timezone")
          }}
        >
          <ComboboxInput
            className="w-72"
            placeholder="Select a timezone"
            showClear={false}
          >
            <InputGroupAddon>
              <GlobeHemisphereEastIcon />
            </InputGroupAddon>
          </ComboboxInput>
          <ComboboxContent align="end" alignOffset={-28} className="w-80">
            <ComboboxEmpty>No timezones found.</ComboboxEmpty>
            <ComboboxList>
              {(group: WorkspaceTimeZoneOptionGroup) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  <ComboboxLabel>{group.value}</ComboboxLabel>
                  <ComboboxCollection>
                    {(item: WorkspaceTimeZoneOption) => (
                      <ComboboxItem key={item.value} value={item.value}>
                        <div className="flex min-w-0 flex-col">
                          <span>{item.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.value}
                          </span>
                        </div>
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxGroup>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
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
          disabled={mutation.isPending}
          value={preferences.timeFormatPreference}
          onValueChange={(nextValue) => {
            if (!nextValue) {
              return
            }

            void updatePreference(
              "timeFormatPreference",
              nextValue as WorkspaceTimeFormatPreference,
              "update-time-format",
            )
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {getTimeFormatPreferenceOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </SettingsRow>
    </SettingsCard>
  )
}

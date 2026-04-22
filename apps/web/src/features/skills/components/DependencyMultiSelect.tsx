import { CaretDown, CheckCircle, Circle } from "@phosphor-icons/react/ssr"
import type * as React from "react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import {
  type DependencySelectOption,
  filterDependencySelectOptions,
  type IntegrationDependencySelectOption,
  toggleDependencySelection,
} from "../dependency-select-options"

export interface DependencyMultiSelectProps<
  TOption extends DependencySelectOption,
> {
  disabled?: boolean
  emptyMessage: string
  getOptionMeta?: (option: TOption) => React.ReactNode
  options: TOption[]
  placeholder: string
  searchPlaceholder: string
  selectedValues: string[]
  onSelectedValuesChange: (selectedValues: string[]) => void
}

export interface IntegrationDependencyOptionMetaProps {
  option: IntegrationDependencySelectOption
}

function getSelectionSummary<TOption extends DependencySelectOption>(
  options: TOption[],
  selectedValues: string[],
  placeholder: string,
) {
  if (selectedValues.length === 0) {
    return placeholder
  }

  const labelByValue = new Map(
    options.map((option) => [option.value, option.label]),
  )

  return selectedValues
    .map((value) => labelByValue.get(value) ?? value)
    .sort((left, right) => left.localeCompare(right))
    .join(", ")
}

export function IntegrationDependencyOptionMeta({
  option,
}: IntegrationDependencyOptionMetaProps) {
  return option.installed ? (
    <CheckCircle
      aria-label="Installed"
      className="size-4 shrink-0 text-emerald-500"
      weight="fill"
    />
  ) : (
    <Circle
      aria-label="Not installed"
      className="size-4 shrink-0 text-muted-foreground/60"
    />
  )
}

export function DependencyMultiSelect<TOption extends DependencySelectOption>({
  disabled = false,
  emptyMessage,
  getOptionMeta,
  onSelectedValuesChange,
  options,
  placeholder,
  searchPlaceholder,
  selectedValues,
}: DependencyMultiSelectProps<TOption>) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues])
  const filteredOptions = useMemo(
    () => filterDependencySelectOptions(options, search),
    [options, search],
  )
  const summary = getSelectionSummary(options, selectedValues, placeholder)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            className="w-full justify-between overflow-hidden"
            disabled={disabled}
            type="button"
            variant="outline"
          />
        }
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            selectedValues.length === 0 && "text-muted-foreground",
          )}
        >
          {summary}
        </span>
        <CaretDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(32rem,var(--available-width))] gap-0 overflow-hidden p-0"
        sideOffset={6}
      >
        <Command shouldFilter={false}>
          <CommandInput
            aria-label={searchPlaceholder}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
            value={search}
          />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => {
                const selected = selectedSet.has(option.value)

                return (
                  <CommandItem
                    data-checked={selected}
                    key={option.value}
                    onSelect={() =>
                      onSelectedValuesChange(
                        toggleDependencySelection(selectedValues, option.value),
                      )
                    }
                    value={option.searchText}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap">
                      {"iconSrc" in option &&
                      typeof option.iconSrc === "string" &&
                      option.iconSrc ? (
                        <img
                          alt=""
                          className="size-4 shrink-0 rounded-sm"
                          src={option.iconSrc}
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate">
                        {option.label}
                      </span>
                      {option.value !== option.label ? (
                        <code className="shrink-0 text-xs text-muted-foreground">
                          {option.value}
                        </code>
                      ) : null}
                      {getOptionMeta ? getOptionMeta(option) : null}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

"use client"

import { MagnifyingGlass } from "@phosphor-icons/react/ssr"
import type { ComponentProps } from "react"
import { useState } from "react"

import { cn } from "@/lib/utils"

export interface ToolbarSearchInputProps extends ComponentProps<"input"> {
  containerClassName?: string
}

export function ToolbarSearchInput({
  className,
  containerClassName,
  onBlur,
  onFocus,
  ...props
}: ToolbarSearchInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div
      className={cn(
        "flex h-9 w-full max-w-md items-center gap-2 rounded-full border bg-input/50 px-4 py-1.5 transition-shadow",
        containerClassName,
      )}
      style={focused ? { borderColor: "var(--primary)" } : undefined}
    >
      <MagnifyingGlass className="size-4 shrink-0 text-muted-foreground" />
      <input
        className={cn(
          "w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground",
          className,
        )}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        {...props}
      />
    </div>
  )
}

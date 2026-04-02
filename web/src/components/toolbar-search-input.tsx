"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as React from "react";

import { cn } from "@/lib/utils";

type ToolbarSearchInputProps = React.ComponentProps<"input"> & {
  containerClassName?: string;
};

export function ToolbarSearchInput({
  className,
  containerClassName,
  onBlur,
  onFocus,
  ...props
}: ToolbarSearchInputProps) {
  const [focused, setFocused] = React.useState(false);

  return (
    <div
      className={cn(
        "flex h-11 w-full max-w-md items-center gap-2 rounded-full border bg-input/50 px-4 py-2 transition-shadow",
        containerClassName,
      )}
      style={focused ? { borderColor: "var(--primary)" } : undefined}
    >
      <HugeiconsIcon
        className="size-4 shrink-0 text-muted-foreground"
        icon={Search01Icon}
      />
      <input
        className={cn(
          "w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground",
          className,
        )}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        {...props}
      />
    </div>
  );
}

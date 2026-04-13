import type { PropsWithChildren } from "react"

import { cn } from "@/lib/utils"

import { ShellNotificationCenter } from "./notifications/ShellNotificationCenter"

export interface ShellViewportProps extends PropsWithChildren {
  className?: string
}

export function ShellViewport({ children, className }: ShellViewportProps) {
  return (
    <div
      className={cn(
        "flex h-dvh min-h-dvh flex-col overflow-hidden bg-sidebar",
        className,
      )}
    >
      <ShellNotificationCenter />
      {children}
    </div>
  )
}

import type { PropsWithChildren } from "react"

import { cn } from "@/lib/utils"

export interface ShellStageProps extends PropsWithChildren {
  className?: string
}

export function ShellStage({ children, className }: ShellStageProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 overflow-hidden", className)}>
      {children}
    </div>
  )
}

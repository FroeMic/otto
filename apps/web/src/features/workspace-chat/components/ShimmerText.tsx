import { cn } from "@/lib/utils"

export interface ShimmerTextProps {
  children: string
  className?: string
}

export function ShimmerText({ children, className }: ShimmerTextProps) {
  return <span className={cn("workspace-trace-shimmer", className)}>{children}</span>
}

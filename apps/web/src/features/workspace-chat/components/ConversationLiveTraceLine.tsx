import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

import { ShimmerText } from "./ShimmerText"

export interface ConversationLiveTraceLineProps {
  label: string
  sequenceKey: string
}

export function ConversationLiveTraceLine({
  label,
  sequenceKey,
}: ConversationLiveTraceLineProps) {
  const [animationKey, setAnimationKey] = useState(sequenceKey)

  useEffect(() => {
    setAnimationKey(sequenceKey)
  }, [sequenceKey])

  return (
    <div className="min-w-0">
      <p
        className={cn(
          "workspace-trace-flip truncate text-sm font-medium text-muted-foreground",
        )}
        key={animationKey}
      >
        <ShimmerText>{label}</ShimmerText>
      </p>
    </div>
  )
}

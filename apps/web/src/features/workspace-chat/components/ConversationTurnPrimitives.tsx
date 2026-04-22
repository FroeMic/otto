import { OttoAvatar } from "@/components/OttoAvatar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

import type { WorkspaceConversationTurnKind } from "../presentation"

export interface ConversationTurnShellProps {
  children: React.ReactNode
  kind: WorkspaceConversationTurnKind
}

export function ConversationTurnShell({
  children,
  kind,
}: ConversationTurnShellProps) {
  return (
    <div
      className={cn(
        "flex w-full",
        kind === "current_user" ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col gap-2",
          kind === "current_user" ? "items-end" : "items-start",
        )}
      >
        {children}
      </div>
    </div>
  )
}

export interface ConversationTurnHeaderProps {
  kind: WorkspaceConversationTurnKind
  name: string
  timestampLabel: string
}

export function ConversationTurnHeader({
  kind,
  name,
  timestampLabel,
}: ConversationTurnHeaderProps) {
  const isCurrentUser = kind === "current_user"

  if (isCurrentUser) {
    return (
      <div className="flex max-w-full flex-nowrap items-center justify-end gap-3 overflow-hidden text-right">
        <div className="flex min-w-0 flex-nowrap items-center gap-2 whitespace-nowrap">
          <p className="shrink-0 text-xs text-muted-foreground">
            {timestampLabel}
          </p>
          <p className="truncate text-xs font-medium text-foreground/75">
            {name}
          </p>
        </div>
        <ConversationTurnAvatar kind={kind} name={name} />
      </div>
    )
  }

  return (
    <div className="flex max-w-full flex-nowrap items-center gap-3 overflow-hidden text-left">
      <ConversationTurnAvatar kind={kind} name={name} />
      <div className="flex min-w-0 flex-nowrap items-center gap-2 whitespace-nowrap">
        <p className="truncate text-xs font-medium text-foreground/75">
          {name}
        </p>
        <p className="shrink-0 text-xs text-muted-foreground">
          {timestampLabel}
        </p>
      </div>
    </div>
  )
}

export interface ConversationTurnAvatarProps {
  kind: WorkspaceConversationTurnKind
  name: string
}

export function ConversationTurnAvatar({
  kind,
  name,
}: ConversationTurnAvatarProps) {
  const initial = name.charAt(0).toUpperCase() || "?"

  if (kind === "assistant") {
    return <OttoAvatar className="size-7 rounded-md border border-border" />
  }

  return (
    <Avatar className="size-7" size="sm">
      <AvatarFallback
        className={cn(
          "text-xs font-medium text-white",
          kind === "current_user"
            ? "bg-secondary-foreground"
            : kind === "system"
              ? "bg-muted-foreground"
              : getAvatarColor(name),
        )}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  )
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-teal-500",
  ]
  let hash = 0

  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index)
    hash |= 0
  }

  return colors[Math.abs(hash) % colors.length]
}

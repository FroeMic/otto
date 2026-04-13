import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
  badgeLabel?: string
  kind: WorkspaceConversationTurnKind
  name: string
  statusLabel?: string | null
  timestampLabel: string
}

export function ConversationTurnHeader({
  badgeLabel,
  kind,
  name,
  statusLabel,
  timestampLabel,
}: ConversationTurnHeaderProps) {
  const isCurrentUser = kind === "current_user"

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        isCurrentUser ? "flex-row-reverse text-right" : "flex-row",
      )}
    >
      <ConversationTurnAvatar kind={kind} name={name} />
      <div
        className={cn(
          "flex min-w-0 flex-col gap-0.5",
          isCurrentUser ? "items-end" : "items-start",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-foreground/75">{name}</p>
          {badgeLabel ? (
            <Badge className="px-1.5 py-0 text-[10px]" variant="outline">
              {badgeLabel}
            </Badge>
          ) : null}
          {statusLabel ? (
            <Badge className="px-1.5 py-0 text-[10px]" variant="secondary">
              {statusLabel}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{timestampLabel}</p>
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

  return (
    <Avatar className="size-7" size="sm">
      <AvatarFallback
        className={cn(
          "text-xs font-medium text-white",
          kind === "assistant"
            ? "bg-primary"
            : kind === "current_user"
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

import { XIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type {
  ShellNotificationBase,
  ShellNotificationRenderer,
} from "./notification-types"

const shellNotificationToneStyles: Record<
  NonNullable<ShellNotificationBase["tone"]>,
  string
> = {
  danger: "border-rose-500/30 bg-rose-500/10",
  info: "border-border bg-background/95",
  success: "border-emerald-500/30 bg-emerald-500/10",
  warning: "border-amber-500/30 bg-amber-500/10",
}

const defaultShellNotificationRenderer: ShellNotificationRenderer = ({
  dismiss,
  notification,
}) => (
  <div className="px-3 pt-3 md:px-4">
    <div
      className={cn(
        "mx-auto flex w-full items-start gap-4 rounded-2xl border px-4 py-3 shadow-sm",
        shellNotificationToneStyles[notification.tone ?? "info"],
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-[-0.01em] text-foreground">
          {notification.title}
        </p>
        {notification.detail ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {notification.detail}
          </p>
        ) : null}
      </div>

      <Button
        aria-label="Dismiss notification"
        className="size-8 shrink-0"
        onClick={dismiss}
        size="icon-sm"
        variant="ghost"
      >
        <XIcon />
      </Button>
    </div>
  </div>
)

export const shellNotificationRegistry: Record<
  string,
  ShellNotificationRenderer
> = {
  default: defaultShellNotificationRenderer,
}

export function renderShellNotification(
  notification: ShellNotificationBase,
  dismiss: () => void,
) {
  const renderer =
    shellNotificationRegistry[notification.kind] ??
    shellNotificationRegistry.default

  return renderer({
    dismiss,
    notification,
  })
}

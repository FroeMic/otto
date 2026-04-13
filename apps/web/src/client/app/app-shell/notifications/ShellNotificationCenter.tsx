"use client"

import { renderShellNotification } from "./notification-registry"
import { useShellNotifications } from "./ShellNotificationProvider"

export function ShellNotificationCenter() {
  const { current, dismissCurrent } = useShellNotifications()

  if (!current) {
    return null
  }

  return renderShellNotification(current, dismissCurrent)
}

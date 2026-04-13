"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react"

import {
  createShellNotificationQueue,
  dismissCurrentShellNotification,
  enqueueShellNotification,
} from "./notification-queue"
import type {
  ShellNotificationBase,
  ShellNotificationDraft,
} from "./notification-types"

export interface ShellNotificationContextValue {
  current: ShellNotificationBase | null
  dismissCurrent: () => void
  notify: (draft: ShellNotificationDraft) => string
}

const ShellNotificationContext =
  createContext<ShellNotificationContextValue | null>(null)

function createShellNotificationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `shell-notification-${Date.now()}-${Math.round(Math.random() * 10_000)}`
}

export interface ShellNotificationProviderProps extends PropsWithChildren {}

export function ShellNotificationProvider({
  children,
}: ShellNotificationProviderProps) {
  const [queueState, setQueueState] = useState(createShellNotificationQueue)
  const timeoutRef = useRef<number | null>(null)
  const currentNotification = queueState.current

  const dismissCurrent = useCallback(() => {
    setQueueState((state) => dismissCurrentShellNotification(state))
  }, [])

  const notify = useCallback((draft: ShellNotificationDraft) => {
    const notification: ShellNotificationBase = {
      detail: draft.detail,
      dismissAfterMs: draft.dismissAfterMs,
      id: createShellNotificationId(),
      kind: draft.kind ?? "default",
      title: draft.title,
      tone: draft.tone ?? "info",
    }

    setQueueState((state) => enqueueShellNotification(state, notification))

    return notification.id
  }, [])

  useEffect(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (!currentNotification?.dismissAfterMs) {
      return
    }

    timeoutRef.current = window.setTimeout(() => {
      setQueueState((state) => dismissCurrentShellNotification(state))
    }, currentNotification.dismissAfterMs)

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [currentNotification])

  const value = useMemo(
    () => ({
      current: currentNotification,
      dismissCurrent,
      notify,
    }),
    [currentNotification, dismissCurrent, notify],
  )

  return (
    <ShellNotificationContext.Provider value={value}>
      {children}
    </ShellNotificationContext.Provider>
  )
}

export function useShellNotifications() {
  const context = useContext(ShellNotificationContext)

  if (!context) {
    throw new Error(
      "useShellNotifications must be used within ShellNotificationProvider",
    )
  }

  return context
}

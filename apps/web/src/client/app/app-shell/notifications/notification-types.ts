import type { ReactNode } from "react"

export type ShellNotificationTone =
  | "info"
  | "success"
  | "warning"
  | "danger"

export interface ShellNotificationBase {
  detail?: string
  dismissAfterMs?: number
  id: string
  kind: string
  title: string
  tone?: ShellNotificationTone
}

export interface ShellNotificationDraft {
  detail?: string
  dismissAfterMs?: number
  kind?: string
  title: string
  tone?: ShellNotificationTone
}

export interface ShellNotificationRendererProps {
  dismiss: () => void
  notification: ShellNotificationBase
}

export type ShellNotificationRenderer = (
  props: ShellNotificationRendererProps,
) => ReactNode

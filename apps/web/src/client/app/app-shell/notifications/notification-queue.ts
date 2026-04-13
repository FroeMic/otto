import type { ShellNotificationBase } from "./notification-types"

export interface ShellNotificationQueueState {
  current: ShellNotificationBase | null
  queue: ShellNotificationBase[]
}

export const createShellNotificationQueue =
  (): ShellNotificationQueueState => ({
    current: null,
    queue: [],
  })

export function enqueueShellNotification(
  state: ShellNotificationQueueState,
  notification: ShellNotificationBase,
): ShellNotificationQueueState {
  return {
    current: state.current ?? notification,
    queue: [...state.queue, notification],
  }
}

export function dismissCurrentShellNotification(
  state: ShellNotificationQueueState,
): ShellNotificationQueueState {
  if (!state.current) {
    return state
  }

  const remainingQueue = state.queue.filter(
    (item) => item.id !== state.current?.id,
  )

  return {
    current: remainingQueue[0] ?? null,
    queue: remainingQueue,
  }
}

import { describe, expect, it } from "vitest"

import {
  createShellNotificationQueue,
  dismissCurrentShellNotification,
  enqueueShellNotification,
} from "./notification-queue"

describe("shell notification queue", () => {
  it("makes the first enqueued notification current", () => {
    const queue = enqueueShellNotification(createShellNotificationQueue(), {
      id: "one",
      kind: "default",
      title: "First notification",
    })

    expect(queue.current?.id).toBe("one")
    expect(queue.queue).toHaveLength(1)
  })

  it("promotes the next queued notification when the current one is dismissed", () => {
    const withOne = enqueueShellNotification(createShellNotificationQueue(), {
      id: "one",
      kind: "default",
      title: "First notification",
    })
    const withTwo = enqueueShellNotification(withOne, {
      id: "two",
      kind: "default",
      title: "Second notification",
    })

    const dismissed = dismissCurrentShellNotification(withTwo)

    expect(dismissed.current?.id).toBe("two")
    expect(dismissed.queue.map((notification) => notification.id)).toEqual([
      "two",
    ])
  })
})

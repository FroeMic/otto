import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { ScheduledTasksEmptyState } from "./ScheduledTasksEmptyState"

describe("ScheduledTasksEmptyState", () => {
  it("describes an active workspace with no scheduled tasks", () => {
    const html = renderToStaticMarkup(<ScheduledTasksEmptyState />)

    assert.match(html, /No scheduled tasks yet/)
    assert.match(html, /This workspace is set up/)
    assert.doesNotMatch(html, /once Otto is provisioned/)
  })
})

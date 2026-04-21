import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { ConversationTurnHeader } from "./ConversationTurnPrimitives"

describe("ConversationTurnHeader", () => {
  it("does not render assistant identity or running status tags beside the name", () => {
    const markup = renderToStaticMarkup(
      <ConversationTurnHeader
        badgeLabel="Otto"
        kind="assistant"
        name="Otto"
        statusLabel="Running"
        timestampLabel="10:30"
      />,
    )

    assert.match(markup, />Otto</)
    assert.equal(markup.includes(">Running<"), false)
    assert.equal(markup.includes("data-slot=\"badge\""), false)
  })
})

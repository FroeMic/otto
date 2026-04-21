import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { ConversationTurnHeader } from "./ConversationTurnPrimitives"

describe("ConversationTurnHeader", () => {
  it("renders the name and timestamp without identity or status tags", () => {
    const markup = renderToStaticMarkup(
      <ConversationTurnHeader
        kind="assistant"
        name="Otto"
        timestampLabel="10:30"
      />,
    )

    assert.match(markup, />Otto</)
    assert.match(markup, />10:30</)
    assert.equal(markup.includes("data-slot=\"badge\""), false)
  })

  it("keeps user metadata in one inline row after the avatar", () => {
    const markup = renderToStaticMarkup(
      <ConversationTurnHeader
        kind="current_user"
        name="Username"
        timestampLabel="14:40"
      />,
    )

    assert.match(markup, />Username</)
    assert.match(markup, />14:40</)
    assert.match(markup, /flex max-w-full flex-nowrap items-center/)
    assert.match(markup, /flex min-w-0 flex-nowrap items-center/)
    assert.match(markup, /shrink-0 text-xs text-muted-foreground/)
  })
})

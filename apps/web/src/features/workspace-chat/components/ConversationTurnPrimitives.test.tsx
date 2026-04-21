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
    assert.match(markup, /viewBox="0 0 64 64"/)
    assert.equal(markup.includes(">O</span>"), false)
    assert.equal(markup.includes("data-slot=\"badge\""), false)
  })

  it("right-aligns current user metadata before the avatar", () => {
    const markup = renderToStaticMarkup(
      <ConversationTurnHeader
        kind="current_user"
        name="Username"
        timestampLabel="14:40"
      />,
    )

    assert.match(markup, />Username</)
    assert.match(markup, />14:40</)
    assert.match(markup, /justify-end/)
    assert.match(markup, /text-right/)
    assert.match(markup, /flex min-w-0 flex-nowrap items-center/)
    assert.ok(markup.indexOf(">14:40<") < markup.indexOf(">Username<"))
    assert.ok(markup.indexOf(">Username<") < markup.indexOf(">U<"))
    assert.match(markup, /shrink-0 text-xs text-muted-foreground/)
  })
})

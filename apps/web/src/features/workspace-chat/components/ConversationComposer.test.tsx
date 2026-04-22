import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { ConversationComposer } from "./ConversationComposer"

describe("ConversationComposer", () => {
  it("renders a stop button while a conversation turn is running", () => {
    const html = renderToStaticMarkup(
      <ConversationComposer
        isRunning={true}
        orgSlug="otto"
        onStop={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    assert.match(html, /Stop/)
    assert.doesNotMatch(html, />Send</)
  })

  it("keeps the draft textarea editable while a conversation turn is running", () => {
    const html = renderToStaticMarkup(
      <ConversationComposer
        isRunning={true}
        orgSlug="otto"
        onStop={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    const textareaMarkup = html.match(/<textarea[^>]*>/)?.[0] ?? ""

    assert.notEqual(textareaMarkup, "")
    assert.doesNotMatch(textareaMarkup, /\sdisabled(=|\s|>)/)
  })
})

import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { WorkspaceChatPromptSuggestions } from "./WorkspaceChatPromptSuggestions"

describe("WorkspaceChatPromptSuggestions", () => {
  it("renders actionable starter prompts", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceChatPromptSuggestions onSelect={() => undefined} />,
    )

    assert.match(markup, /Research the market/)
    assert.match(markup, /Summarize what changed/)
    assert.match(markup, /Turn this rough plan/)
    assert.match(markup, /Set up a recurring/)
  })
})

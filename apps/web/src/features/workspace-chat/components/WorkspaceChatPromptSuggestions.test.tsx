import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { WorkspaceChatPromptSuggestions } from "./WorkspaceChatPromptSuggestions"

describe("WorkspaceChatPromptSuggestions", () => {
  it("renders actionable starter prompts", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceChatPromptSuggestions onSelect={() => undefined} />,
    )

    assert.match(markup, /Brainstorm a new business idea/)
    assert.match(markup, /Review a business/)
    assert.match(markup, /Work on an existing business/)
    assert.match(markup, /Set up a recurring task/)
  })
})

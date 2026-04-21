import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { ConversationMarkdown } from "./ConversationMarkdown"

describe("ConversationMarkdown", () => {
  it("renders common assistant markdown blocks", () => {
    const markup = renderToStaticMarkup(
      <ConversationMarkdown
        text={[
          "## Plan",
          "",
          "- **Research** the market",
          "- Share `next steps`",
          "",
          "```ts",
          "const ready = true",
          "```",
        ].join("\n")}
      />,
    )

    assert.match(markup, /<h3/)
    assert.match(markup, /<ul/)
    assert.match(markup, /<strong/)
    assert.match(markup, /<code/)
    assert.match(markup, /<pre/)
    assert.match(markup, /const ready = true/)
  })

  it("renders safe links and leaves unsafe links as text", () => {
    const markup = renderToStaticMarkup(
      <ConversationMarkdown text="[Otto](https://getyourotto.com) [bad](javascript:alert(1))" />,
    )

    assert.match(markup, /href="https:\/\/getyourotto.com\/"/)
    assert.match(markup, /\[bad\]\(javascript:alert\(1\)\)/)
  })
})

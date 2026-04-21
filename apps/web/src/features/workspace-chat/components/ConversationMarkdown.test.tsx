import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { ConversationMarkdown } from "./ConversationMarkdown"

describe("ConversationMarkdown", () => {
  it("renders common assistant markdown blocks", () => {
    const markup = renderToStaticMarkup(
      <ConversationMarkdown isStreaming={false}>
        {[
          "## Plan",
          "",
          "- **Research** the market",
          "- Share `next steps`",
          "",
          "```ts",
          "const ready = true",
          "```",
        ].join("\n")}
      </ConversationMarkdown>,
    )

    assert.match(markup, /Plan/)
    assert.match(markup, /<ul/)
    assert.match(markup, /data-streamdown="strong"/)
    assert.match(markup, /<code/)
    assert.match(markup, /<pre/)
    assert.match(markup, /const ready = true/)
  })

  it("renders safe links and leaves unsafe links as text", () => {
    const markup = renderToStaticMarkup(
      <ConversationMarkdown isStreaming={false}>
        [Otto](https://getyourotto.com) [bad](javascript:alert(1))
      </ConversationMarkdown>,
    )

    assert.match(markup, /href="https:\/\/getyourotto.com\/"/)
    assert.equal(markup.includes("javascript:alert"), false)
  })
})

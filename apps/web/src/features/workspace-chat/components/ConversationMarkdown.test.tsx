import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"
import {
  ConversationMarkdown,
  resolveWorkspaceChatMarkdownLinkTarget,
} from "./ConversationMarkdown"

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
    assert.match(markup, /leading-5/)
    assert.match(markup, /data-streamdown=code-block\]\]:my-0/)
    assert.match(markup, /data-streamdown=code-block\]\]:border-0/)
    assert.match(markup, /data-streamdown=code-block\]\]:bg-transparent/)
    assert.match(markup, /data-streamdown=code-block\]\]:p-0/)
    assert.equal(
      markup.includes("data-streamdown=code-block-body]]:border-0"),
      false,
    )
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

  it("opens same-workspace links in place and external links in a new tab", () => {
    const markup = renderToStaticMarkup(
      <ConversationMarkdown
        baseUrl="https://getyourotto.com"
        isStreaming={false}
        orgSlug="interaction42"
      >
        [Settings](https://getyourotto.com/interaction42/settings/agent/personalization)
        [Docs](https://example.com/docs)
      </ConversationMarkdown>,
    )

    const internalAnchor =
      markup.match(
        /<a[^>]+href="https:\/\/getyourotto.com\/interaction42\/settings\/agent\/personalization"[^>]*>/,
      )?.[0] ?? ""
    const externalAnchor =
      markup.match(/<a[^>]+href="https:\/\/example.com\/docs"[^>]*>/)?.[0] ?? ""

    assert.notEqual(internalAnchor, "")
    assert.doesNotMatch(internalAnchor, /\starget=/)
    assert.doesNotMatch(internalAnchor, /\srel=/)
    assert.match(externalAnchor, /\starget="_blank"/)
    assert.match(externalAnchor, /\srel="noreferrer"/)
  })

  it("recognizes same-origin links scoped to the active workspace", () => {
    assert.deepEqual(
      resolveWorkspaceChatMarkdownLinkTarget({
        baseUrl: "https://getyourotto.com",
        href: "https://getyourotto.com/acme/settings",
        orgSlug: "acme",
      }),
      {
        href: "https://getyourotto.com/acme/settings",
        isInternalWorkspaceLink: true,
      },
    )
    assert.equal(
      resolveWorkspaceChatMarkdownLinkTarget({
        baseUrl: "https://getyourotto.com",
        href: "https://getyourotto.com/other/settings",
        orgSlug: "acme",
      }).isInternalWorkspaceLink,
      false,
    )
  })
})

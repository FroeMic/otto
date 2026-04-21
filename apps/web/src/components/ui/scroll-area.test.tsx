import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { ScrollArea } from "./scroll-area"

describe("ScrollArea", () => {
  it("does not draw a focus-visible ring around the viewport", () => {
    const markup = renderToStaticMarkup(<ScrollArea>Content</ScrollArea>)

    assert.match(markup, /data-slot="scroll-area-viewport"/)
    assert.equal(markup.includes("focus-visible:ring"), false)
    assert.equal(markup.includes("focus-visible:outline-1"), false)
  })
})

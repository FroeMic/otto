import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { GitHubIntegrationIcon } from "./GitHubIntegrationIcon"

describe("GitHubIntegrationIcon", () => {
  it("renders light and dark mode GitHub logo assets", () => {
    const markup = renderToStaticMarkup(
      <GitHubIntegrationIcon alt="GitHub" className="size-6" />,
    )

    assert.match(markup, /src="\/integrations\/github\.svg"/)
    assert.match(markup, /src="\/integrations\/github-dark\.svg"/)
    assert.match(markup, /class="[^"]*dark:hidden[^"]*"/)
    assert.match(markup, /class="[^"]*hidden dark:block[^"]*"/)
  })
})

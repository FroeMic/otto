import assert from "node:assert/strict";
import test from "node:test";

import {
  executeBraveWebSearchProxy,
  RuntimeWebSearchProxyError,
} from "./proxy";

test("executeBraveWebSearchProxy normalizes Brave web-search results", async () => {
  const previousFetch = globalThis.fetch;
  const seenRequests: Request[] = [];

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    seenRequests.push(request);

    return Response.json({
      web: {
        results: [
          {
            title: "OpenClaw docs",
            url: "https://docs.openclaw.ai/tools/web",
            description: "Brave provider docs",
            age: "2 days ago",
          },
        ],
      },
    });
  };

  try {
    const result = await executeBraveWebSearchProxy({
      apiKey: "test-brave-key",
      args: {
        count: 3,
        query: "openclaw docs",
      },
      searchConfig: {
        brave: {
          mode: "web",
        },
        enabled: true,
        provider: "brave",
      },
    });

    assert.equal(seenRequests.length, 1);
    assert.match(seenRequests[0]?.url ?? "", /api\.search\.brave\.com/);
    assert.equal(
      seenRequests[0]?.headers.get("X-Subscription-Token"),
      "test-brave-key",
    );
    assert.equal(result.provider, "brave");
    assert.equal(result.count, 1);
    assert.deepEqual(result.results, [
      {
        description: "Brave provider docs",
        published: "2 days ago",
        siteName: "docs.openclaw.ai",
        title: "OpenClaw docs",
        url: "https://docs.openclaw.ai/tools/web",
      },
    ]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("executeBraveWebSearchProxy rejects unsupported llm-context freshness filters cleanly", async () => {
  await assert.rejects(
    () =>
      executeBraveWebSearchProxy({
        apiKey: "test-brave-key",
        args: {
          freshness: "day",
          query: "openclaw docs",
        },
        searchConfig: {
          brave: {
            mode: "llm-context",
          },
          enabled: true,
          provider: "brave",
        },
      }),
    (error) =>
      error instanceof RuntimeWebSearchProxyError &&
      error.status === 400 &&
      error.message.includes("freshness filtering is not supported"),
  );
});

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearAttachmentList } from "./list";

function buildAttachmentNode(overrides: Record<string, unknown> = {}) {
  return {
    archivedAt: null,
    bodyData: null,
    createdAt: "2026-04-07T10:00:00.000Z",
    creator: {
      displayName: "Sam",
      email: "sam@example.com",
      id: "user-1",
      name: "Sam Example",
    },
    id: "attachment-1",
    issue: {
      id: "issue-1",
      identifier: "INT-6",
      title: "Track credits workflow",
    },
    metadata: {
      foo: "bar",
    },
    originalIssue: null,
    source: {
      type: "url",
    },
    sourceType: "url",
    subtitle: "YC deal link",
    title: "AWS Credits",
    updatedAt: "2026-04-07T12:00:00.000Z",
    url: "https://example.com/aws-credits",
    ...overrides,
  };
}

describe("linear attachment commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists attachments", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            attachments: {
              nodes: [buildAttachmentNode()],
            },
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearAttachmentList({
      arguments: {
        limit: 5,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{
        creator: string | null;
        issue: {
          identifier: string | null;
        } | null;
        title: string;
      }>;
      limit: number;
      totalMatched: number;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: { limit: number };
    };

    assert.match(
      payload.query,
      /attachments\(first: \$limit, orderBy: updatedAt\)/,
    );
    assert.equal(payload.variables.limit, 5);
    assert.equal(result.commandKey, "attachment.list");
    assert.equal(result.limit, 5);
    assert.equal(result.totalMatched, 1);
    assert.equal(result.items[0]?.title, "AWS Credits");
    assert.equal(result.items[0]?.creator, "Sam Example");
    assert.equal(result.items[0]?.issue?.identifier, "INT-6");
  });
});

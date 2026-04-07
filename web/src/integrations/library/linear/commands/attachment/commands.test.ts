import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearAttachmentCreate } from "./create";
import { executeLinearAttachmentGet } from "./get";
import { executeLinearAttachmentList } from "./list";
import { executeLinearAttachmentListForUrl } from "./list-for-url";

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

  it("gets one attachment by id", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { id: string };
      };

      assert.equal(body.variables.id, "attachment-1");

      return new Response(
        JSON.stringify({
          data: {
            attachment: buildAttachmentNode(),
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

    const result = (await executeLinearAttachmentGet({
      arguments: {
        attachmentId: "attachment-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      attachment: {
        id: string | null;
        issue: { identifier: string | null } | null;
      } | null;
      commandKey: string;
      lookup: string;
    };

    assert.equal(result.commandKey, "attachment.get");
    assert.equal(result.lookup, "attachment-1");
    assert.equal(result.attachment?.id, "attachment-1");
    assert.equal(result.attachment?.issue?.identifier, "INT-6");
  });

  it("lists attachments for one url", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: { limit: number; url: string };
      };

      assert.equal(body.variables.limit, 3);
      assert.equal(body.variables.url, "https://example.com/aws-credits");

      return new Response(
        JSON.stringify({
          data: {
            attachmentsForURL: {
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

    const result = (await executeLinearAttachmentListForUrl({
      arguments: {
        limit: 3,
        url: "https://example.com/aws-credits",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lookup: string;
      totalMatched: number;
    };

    assert.equal(result.commandKey, "attachment.list_for_url");
    assert.equal(result.lookup, "https://example.com/aws-credits");
    assert.equal(result.totalMatched, 1);
  });

  it("creates attachments with a curated input shape", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: {
          input: {
            commentBody: string;
            groupBySource: boolean;
            issueId: string;
            metadata: { foo: string };
            subtitle: string;
            title: string;
            url: string;
          };
        };
      };

      assert.deepEqual(body.variables.input, {
        commentBody: "Please review this deal link.",
        groupBySource: true,
        issueId: "INT-6",
        metadata: { foo: "bar" },
        subtitle: "YC deal link",
        title: "AWS Credits",
        url: "https://example.com/aws-credits",
      });

      return new Response(
        JSON.stringify({
          data: {
            attachmentCreate: {
              attachment: buildAttachmentNode(),
              lastSyncId: 42,
              success: true,
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

    const result = (await executeLinearAttachmentCreate({
      arguments: {
        commentBody: "Please review this deal link.",
        groupBySource: true,
        issueId: "INT-6",
        metadata: { foo: "bar" },
        subtitle: "YC deal link",
        title: "AWS Credits",
        url: "https://example.com/aws-credits",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      attachment: { id: string | null; issueId: string | null } | null;
      commandKey: string;
      lastSyncId: number | null;
      success: boolean;
    };

    assert.equal(result.commandKey, "attachment.create");
    assert.equal(result.lastSyncId, 42);
    assert.equal(result.success, true);
    assert.equal(result.attachment?.id, "attachment-1");
    assert.equal(result.attachment?.issueId, "issue-1");
  });
});

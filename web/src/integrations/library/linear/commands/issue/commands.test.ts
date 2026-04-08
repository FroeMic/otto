import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearIssueBatchUpdate } from "./batch-update";
import { executeLinearIssueCreate } from "./create";
import { executeLinearIssueDelete } from "./delete";
import { executeLinearIssueInsertInlineImage } from "./insert-inline-image";
import { executeLinearIssueListComments } from "./list-comments";
import { executeLinearIssueUploadInlineImage } from "./upload-inline-image";

function buildIssueNode(overrides: Record<string, unknown> = {}) {
  return {
    assignee: null,
    createdAt: "2026-04-07T10:00:00.000Z",
    description: "Issue description",
    id: "issue-uuid-1",
    identifier: "INT-6",
    labelIds: ["label-1"],
    priority: 2,
    project: {
      id: "project-1",
      name: "Core",
    },
    state: {
      id: "state-1",
      name: "Backlog",
      type: "unstarted",
    },
    team: {
      id: "team-1",
      key: "INT",
      name: "Integration",
    },
    title: "Track credits workflow",
    updatedAt: "2026-04-07T12:00:00.000Z",
    url: "https://linear.app/otto/issue/INT-6/track-credits-workflow",
    ...overrides,
  };
}

describe("linear issue commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("creates issues with a curated input shape", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            issueCreate: {
              issue: buildIssueNode(),
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

    const result = (await executeLinearIssueCreate({
      arguments: {
        description: "Need a credits workflow",
        labelIds: ["label-1"],
        priority: 2,
        teamId: "team-1",
        title: "Track credits workflow",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      issue: {
        identifier: string | null;
        title: string;
      } | null;
      lastSyncId: number | null;
      success: boolean;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        input: Record<string, unknown>;
      };
    };

    assert.match(payload.query, /issueCreate/);
    assert.deepEqual(payload.variables.input, {
      description: "Need a credits workflow",
      labelIds: ["label-1"],
      priority: 2,
      teamId: "team-1",
      title: "Track credits workflow",
    });
    assert.equal(result.commandKey, "issue.create");
    assert.equal(result.issue?.identifier, "INT-6");
    assert.equal(result.issue?.title, "Track credits workflow");
    assert.equal(result.lastSyncId, 42);
    assert.equal(result.success, true);
  });

  it("lists issue comments after resolving an issue identifier", async () => {
    let callCount = 0;
    globalThis.fetch = (async (_input, init) => {
      callCount += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        query: string;
        variables: Record<string, unknown>;
      };

      if (body.query.includes("searchIssues")) {
        return new Response(
          JSON.stringify({
            data: {
              searchIssues: {
                nodes: [buildIssueNode()],
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
      }

      assert.match(body.query, /comments\(first: \$limit\)/);
      assert.equal(body.variables.id, "issue-uuid-1");
      assert.equal(body.variables.limit, 25);

      return new Response(
        JSON.stringify({
          data: {
            issue: {
              ...buildIssueNode(),
              comments: {
                nodes: [
                  {
                    body: "We should bill this separately.",
                    createdAt: "2026-04-07T11:00:00.000Z",
                    id: "comment-1",
                    issueId: "issue-uuid-1",
                    parentId: null,
                    quotedText: null,
                    resolvedAt: null,
                    updatedAt: "2026-04-07T11:05:00.000Z",
                    url: "https://linear.app/otto/issue/INT-6#comment-1",
                    user: {
                      email: "sam@example.com",
                      id: "user-1",
                      name: "Sam",
                    },
                  },
                ],
              },
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

    const result = (await executeLinearIssueListComments({
      arguments: {
        identifierOrId: "INT-6",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      issue: {
        identifier: string | null;
      };
      items: Array<{
        body: string;
        user: string | null;
      }>;
      totalMatched: number;
    };

    assert.equal(callCount, 2);
    assert.equal(result.commandKey, "issue.list_comments");
    assert.equal(result.issue.identifier, "INT-6");
    assert.equal(result.items[0]?.body, "We should bill this separately.");
    assert.equal(result.items[0]?.user, "Sam");
    assert.equal(result.totalMatched, 1);
  });

  it("batch updates multiple issues after resolving identifiers to ids", async () => {
    const lookups = new Map([
      ["INT-6", "issue-uuid-1"],
      ["INT-7", "issue-uuid-2"],
    ]);
    let mutationVariables: Record<string, unknown> | null = null;

    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        query: string;
        variables: Record<string, unknown>;
      };

      if (body.query.includes("searchIssues")) {
        const term = String(body.variables.term);
        const id = lookups.get(term);
        assert.ok(id);

        return new Response(
          JSON.stringify({
            data: {
              searchIssues: {
                nodes: [
                  buildIssueNode({
                    id,
                    identifier: term,
                  }),
                ],
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
      }

      mutationVariables = body.variables;

      return new Response(
        JSON.stringify({
          data: {
            issueBatchUpdate: {
              issues: [
                buildIssueNode({
                  id: "issue-uuid-1",
                  identifier: "INT-6",
                  priority: 1,
                }),
                buildIssueNode({
                  id: "issue-uuid-2",
                  identifier: "INT-7",
                  priority: 1,
                  title: "Second issue",
                }),
              ],
              lastSyncId: 77,
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

    const result = (await executeLinearIssueBatchUpdate({
      arguments: {
        identifiersOrIds: ["INT-6", "INT-7"],
        priority: 1,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      items: Array<{
        identifier: string | null;
        priority: number;
      }>;
      totalChanged: number;
    };

    assert.deepEqual(mutationVariables, {
      ids: ["issue-uuid-1", "issue-uuid-2"],
      input: {
        priority: 1,
      },
    });
    assert.equal(result.commandKey, "issue.batch_update");
    assert.equal(result.totalChanged, 2);
    assert.deepEqual(
      result.items.map((item) => item.identifier),
      ["INT-6", "INT-7"],
    );
    assert.deepEqual(
      result.items.map((item) => item.priority),
      [1, 1],
    );
  });

  it("inserts an inline image after anchor text", async () => {
    const requests: Array<{
      query: string;
      variables: Record<string, unknown>;
    }> = [];

    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        query: string;
        variables: Record<string, unknown>;
      };
      requests.push(body);

      if (body.query.includes("searchIssues")) {
        return new Response(
          JSON.stringify({
            data: {
              searchIssues: {
                nodes: [
                  buildIssueNode({
                    description: "Intro\n\n## Assets",
                  }),
                ],
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
      }

      assert.match(body.query, /issueUpdate/);
      assert.deepEqual(body.variables, {
        id: "issue-uuid-1",
        input: {
          description:
            "Intro\n\n## Assets\n\n![OpenClaw logo](https://uploads.linear.app/assets/logo.png)",
        },
      });

      return new Response(
        JSON.stringify({
          data: {
            issueUpdate: {
              issue: buildIssueNode({
                description:
                  "Intro\n\n## Assets\n\n![OpenClaw logo](https://uploads.linear.app/assets/logo.png)",
              }),
              lastSyncId: 80,
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

    const result = (await executeLinearIssueInsertInlineImage({
      arguments: {
        altText: "OpenClaw logo",
        anchorText: "## Assets",
        assetUrl: "https://uploads.linear.app/assets/logo.png",
        identifierOrId: "INT-6",
        position: "after_text",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      anchorMatched: boolean;
      commandKey: string;
      insertedMarkdown: string;
      insertionMode: string;
      issue: { description: string | null } | null;
      lastSyncId: number | null;
    };

    assert.equal(requests.length, 2);
    assert.equal(result.commandKey, "issue.insert_inline_image");
    assert.equal(result.anchorMatched, true);
    assert.equal(result.insertionMode, "after_text");
    assert.equal(
      result.insertedMarkdown,
      "![OpenClaw logo](https://uploads.linear.app/assets/logo.png)",
    );
    assert.equal(result.lastSyncId, 80);
    assert.match(result.issue?.description ?? "", /!\[OpenClaw logo\]/);
  });

  it("uploads an inline image and appends it to the issue description", async () => {
    let graphqlCallCount = 0;

    globalThis.fetch = (async (input, init) => {
      const url = String(input);

      if (url.includes("signed-upload.example.com")) {
        const body =
          init?.body instanceof Blob
            ? await init.body.text()
            : String(init?.body ?? "");

        assert.equal(String(init?.method ?? "GET"), "PUT");
        assert.equal(body, "hello world");
        assert.equal(
          new Headers(init?.headers).get("content-type"),
          "image/png",
        );

        return new Response(null, { status: 200 });
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as {
        query: string;
        variables: Record<string, unknown>;
      };
      graphqlCallCount += 1;

      if (body.query.includes("fileUpload(")) {
        return new Response(
          JSON.stringify({
            data: {
              fileUpload: {
                lastSyncId: 91,
                success: true,
                uploadFile: {
                  assetUrl:
                    "https://uploads.linear.app/assets/openclaw-logo.png",
                  contentType: "image/png",
                  filename: "openclaw-logo.png",
                  headers: [
                    {
                      key: "x-amz-acl",
                      value: "private",
                    },
                  ],
                  metaData: {
                    purpose: "inline-image",
                  },
                  size: 11,
                  uploadUrl:
                    "https://signed-upload.example.com/openclaw-logo.png",
                },
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
      }

      if (body.query.includes("searchIssues")) {
        return new Response(
          JSON.stringify({
            data: {
              searchIssues: {
                nodes: [
                  buildIssueNode({
                    description: "Current description",
                  }),
                ],
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
      }

      assert.match(body.query, /issueUpdate/);
      assert.deepEqual(body.variables, {
        id: "issue-uuid-1",
        input: {
          description:
            "Current description\n\n![Inline logo](https://uploads.linear.app/assets/openclaw-logo.png)",
        },
      });

      return new Response(
        JSON.stringify({
          data: {
            issueUpdate: {
              issue: buildIssueNode({
                description:
                  "Current description\n\n![Inline logo](https://uploads.linear.app/assets/openclaw-logo.png)",
              }),
              lastSyncId: 92,
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

    const result = (await executeLinearIssueUploadInlineImage({
      arguments: {
        altText: "Inline logo",
        contentBase64: Buffer.from("hello world").toString("base64"),
        contentType: "image/png",
        filename: "openclaw-logo.png",
        identifierOrId: "INT-6",
        metaData: { purpose: "inline-image" },
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      insertionMode: string;
      issue: { description: string | null } | null;
      uploadFile: { assetUrl: string | null } | null;
      uploadedAssetUrl: string | null;
      uploadedBytes: number;
    };

    assert.equal(graphqlCallCount, 3);
    assert.equal(result.commandKey, "issue.upload_inline_image");
    assert.equal(result.insertionMode, "append");
    assert.equal(result.uploadedBytes, 11);
    assert.equal(
      result.uploadedAssetUrl,
      "https://uploads.linear.app/assets/openclaw-logo.png",
    );
    assert.equal(
      result.uploadFile?.assetUrl,
      "https://uploads.linear.app/assets/openclaw-logo.png",
    );
    assert.match(result.issue?.description ?? "", /!\[Inline logo\]/);
  });

  it("deletes one issue after resolving its identifier", async () => {
    let callCount = 0;
    globalThis.fetch = (async (_input, init) => {
      callCount += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        query: string;
        variables: Record<string, unknown>;
      };

      if (body.query.includes("searchIssues")) {
        return new Response(
          JSON.stringify({
            data: {
              searchIssues: {
                nodes: [buildIssueNode()],
              },
            },
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      assert.match(body.query, /mutation OttoLinearIssueDelete/);
      assert.deepEqual(body.variables, {
        id: "issue-uuid-1",
      });

      return new Response(
        JSON.stringify({
          data: {
            issueDelete: {
              entityId: "issue-uuid-1",
              lastSyncId: 93,
              success: true,
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = (await executeLinearIssueDelete({
      arguments: {
        identifierOrId: "INT-6",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      deletedIssueId: string | null;
      lastSyncId: number | null;
      lookup: string;
      success: boolean;
    };

    assert.equal(callCount, 2);
    assert.equal(result.commandKey, "issue.delete");
    assert.equal(result.deletedIssueId, "issue-uuid-1");
    assert.equal(result.lastSyncId, 93);
    assert.equal(result.lookup, "INT-6");
    assert.equal(result.success, true);
  });
});

import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import { executeLinearAttachmentCreate } from "./create";
import { executeLinearAttachmentCreateFromUploadedFile } from "./create-from-uploaded-file";
import { executeLinearAttachmentGet } from "./get";
import { executeLinearAttachmentList } from "./list";
import { executeLinearAttachmentListForUrl } from "./list-for-url";
import { executeLinearAttachmentRequestUploadUrl } from "./request-upload-url";
import { executeLinearAttachmentUpdate } from "./update";
import { executeLinearAttachmentUploadFile } from "./upload-file";

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

  it("creates attachments from uploaded file asset urls", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: {
          input: {
            issueId: string;
            subtitle: string;
            title: string;
            url: string;
          };
        };
      };

      assert.deepEqual(body.variables.input, {
        issueId: "INT-6",
        subtitle: "Uploaded PDF",
        title: "Credits PDF",
        url: "https://uploads.linear.app/assets/credits.pdf",
      });

      return new Response(
        JSON.stringify({
          data: {
            attachmentCreate: {
              attachment: buildAttachmentNode({
                title: "Credits PDF",
                url: "https://uploads.linear.app/assets/credits.pdf",
              }),
              lastSyncId: 43,
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

    const result = (await executeLinearAttachmentCreateFromUploadedFile({
      arguments: {
        assetUrl: "https://uploads.linear.app/assets/credits.pdf",
        issueId: "INT-6",
        subtitle: "Uploaded PDF",
        title: "Credits PDF",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      attachment: { title: string; url: string | null } | null;
      commandKey: string;
      lastSyncId: number | null;
    };

    assert.equal(result.commandKey, "attachment.create_from_uploaded_file");
    assert.equal(result.lastSyncId, 43);
    assert.equal(result.attachment?.title, "Credits PDF");
    assert.equal(
      result.attachment?.url,
      "https://uploads.linear.app/assets/credits.pdf",
    );
  });

  it("updates attachments with a curated input shape", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: {
          id: string;
          input: {
            metadata: { foo: string };
            subtitle: string;
            title: string;
          };
        };
      };

      assert.equal(body.variables.id, "attachment-1");
      assert.deepEqual(body.variables.input, {
        metadata: { foo: "baz" },
        subtitle: "Updated subtitle",
        title: "Updated attachment title",
      });

      return new Response(
        JSON.stringify({
          data: {
            attachmentUpdate: {
              attachment: buildAttachmentNode({
                metadata: { foo: "baz" },
                subtitle: "Updated subtitle",
                title: "Updated attachment title",
              }),
              lastSyncId: 44,
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

    const result = (await executeLinearAttachmentUpdate({
      arguments: {
        attachmentId: "attachment-1",
        metadata: { foo: "baz" },
        subtitle: "Updated subtitle",
        title: "Updated attachment title",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      attachment: { title: string; subtitle: string | null } | null;
      commandKey: string;
      lastSyncId: number | null;
    };

    assert.equal(result.commandKey, "attachment.update");
    assert.equal(result.lastSyncId, 44);
    assert.equal(result.attachment?.title, "Updated attachment title");
    assert.equal(result.attachment?.subtitle, "Updated subtitle");
  });

  it("requests signed upload metadata for files", async () => {
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables: {
          contentType: string;
          filename: string;
          makePublic: boolean;
          metaData: { purpose: string };
          size: number;
        };
      };

      assert.deepEqual(body.variables, {
        contentType: "application/pdf",
        filename: "credits.pdf",
        makePublic: false,
        metaData: { purpose: "smoke-test" },
        size: 12345,
      });

      return new Response(
        JSON.stringify({
          data: {
            fileUpload: {
              lastSyncId: 45,
              success: true,
              uploadFile: {
                assetUrl: "https://uploads.linear.app/assets/credits.pdf",
                contentType: "application/pdf",
                filename: "credits.pdf",
                headers: [
                  {
                    key: "x-amz-acl",
                    value: "private",
                  },
                ],
                metaData: {
                  purpose: "smoke-test",
                },
                size: 12345,
                uploadUrl: "https://signed-upload.example.com/credits.pdf",
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

    const result = (await executeLinearAttachmentRequestUploadUrl({
      arguments: {
        contentType: "application/pdf",
        filename: "credits.pdf",
        makePublic: false,
        metaData: { purpose: "smoke-test" },
        size: 12345,
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lastSyncId: number | null;
      nextStep: {
        followupCommands: Array<{ commandKey: string }>;
      } | null;
      uploadFile: {
        assetUrl: string | null;
        headers: Array<{ key: string; value: string }>;
        uploadUrl: string | null;
      } | null;
    };

    assert.equal(result.commandKey, "attachment.request_upload_url");
    assert.equal(result.lastSyncId, 45);
    assert.equal(
      result.uploadFile?.assetUrl,
      "https://uploads.linear.app/assets/credits.pdf",
    );
    assert.equal(
      result.uploadFile?.uploadUrl,
      "https://signed-upload.example.com/credits.pdf",
    );
    assert.equal(result.uploadFile?.headers[0]?.key, "x-amz-acl");
    assert.deepEqual(
      result.nextStep?.followupCommands.map((command) => command.commandKey),
      ["attachment.create_from_uploaded_file", "issue.insert_inline_image"],
    );
  });

  it("uploads file bytes and creates the final attachment", async () => {
    const requests: Array<{
      body: string;
      headers: Headers;
      method: string;
      url: string;
    }> = [];

    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? "GET");
      const headers = new Headers(init?.headers);
      const body =
        init?.body instanceof Blob
          ? await init.body.text()
          : init?.body instanceof Buffer
            ? init.body.toString("utf8")
            : String(init?.body ?? "");

      requests.push({
        body,
        headers,
        method,
        url,
      });

      if (url.includes("api.linear.app/graphql")) {
        const parsed = JSON.parse(body) as {
          query: string;
          variables: Record<string, unknown>;
        };

        if (parsed.query.includes("fileUpload(")) {
          return new Response(
            JSON.stringify({
              data: {
                fileUpload: {
                  lastSyncId: 45,
                  success: true,
                  uploadFile: {
                    assetUrl: "https://uploads.linear.app/assets/credits.pdf",
                    contentType: "application/pdf",
                    filename: "credits.pdf",
                    headers: [
                      {
                        key: "x-amz-acl",
                        value: "private",
                      },
                    ],
                    metaData: {
                      purpose: "smoke-test",
                    },
                    size: 15,
                    uploadUrl: "https://signed-upload.example.com/credits.pdf",
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

        assert.match(parsed.query, /attachmentCreate/);
        assert.deepEqual(parsed.variables.input, {
          issueId: "INT-6",
          metadata: { foo: "bar" },
          subtitle: "Uploaded PDF",
          title: "Credits PDF",
          url: "https://uploads.linear.app/assets/credits.pdf",
        });

        return new Response(
          JSON.stringify({
            data: {
              attachmentCreate: {
                attachment: buildAttachmentNode({
                  metadata: { foo: "bar" },
                  subtitle: "Uploaded PDF",
                  title: "Credits PDF",
                  url: "https://uploads.linear.app/assets/credits.pdf",
                }),
                lastSyncId: 46,
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
      }

      assert.equal(url, "https://signed-upload.example.com/credits.pdf");
      assert.equal(method, "PUT");
      assert.equal(headers.get("content-type"), "application/pdf");
      assert.equal(headers.get("cache-control"), "public, max-age=31536000");
      assert.equal(headers.get("x-amz-acl"), "private");
      assert.equal(body, "hello world");

      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const result = (await executeLinearAttachmentUploadFile({
      arguments: {
        contentBase64: Buffer.from("hello world").toString("base64"),
        contentType: "application/pdf",
        filename: "credits.pdf",
        issueIdentifierOrId: "INT-6",
        metaData: { purpose: "smoke-test" },
        metadata: { foo: "bar" },
        subtitle: "Uploaded PDF",
        title: "Credits PDF",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      attachment: { title: string; url: string | null } | null;
      commandKey: string;
      lastSyncId: number | null;
      uploadFile: { assetUrl: string | null } | null;
      uploadedBytes: number;
    };

    assert.equal(result.commandKey, "attachment.upload_file");
    assert.equal(result.lastSyncId, 46);
    assert.equal(result.uploadedBytes, 11);
    assert.equal(result.attachment?.title, "Credits PDF");
    assert.equal(
      result.attachment?.url,
      "https://uploads.linear.app/assets/credits.pdf",
    );
    assert.equal(
      result.uploadFile?.assetUrl,
      "https://uploads.linear.app/assets/credits.pdf",
    );
    assert.equal(requests.length, 3);
  });
});

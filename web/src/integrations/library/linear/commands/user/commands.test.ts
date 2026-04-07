import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearUserGet } from "./get";

function buildUserNode(overrides: Record<string, unknown> = {}) {
  return {
    active: true,
    admin: false,
    displayName: "Sam",
    email: "sam@example.com",
    guest: false,
    id: "user-1",
    isAssignable: true,
    isMentionable: true,
    lastSeen: "2026-04-07T10:00:00.000Z",
    name: "Sam Example",
    owner: false,
    statusEmoji: "🚧",
    statusLabel: "Heads down",
    statusUntilAt: "2026-04-08T10:00:00.000Z",
    ...overrides,
  };
}

describe("linear user commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("gets one user by id", async () => {
    let requestBody = "";
    globalThis.fetch = (async (_input, init) => {
      requestBody = String(init?.body ?? "");

      return new Response(
        JSON.stringify({
          data: {
            user: buildUserNode(),
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

    const result = (await executeLinearUserGet({
      arguments: {
        userId: "user-1",
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      lookup: string;
      user: {
        email: string | null;
        id: string | null;
        name: string;
        statusLabel: string | null;
      } | null;
    };

    const payload = JSON.parse(requestBody) as {
      query: string;
      variables: {
        id: string;
      };
    };

    assert.match(payload.query, /query OttoLinearUserGet/);
    assert.equal(payload.variables.id, "user-1");
    assert.equal(result.commandKey, "user.get");
    assert.equal(result.lookup, "user-1");
    assert.equal(result.user?.id, "user-1");
    assert.equal(result.user?.email, "sam@example.com");
    assert.equal(result.user?.name, "Sam Example");
    assert.equal(result.user?.statusLabel, "Heads down");
  });
});

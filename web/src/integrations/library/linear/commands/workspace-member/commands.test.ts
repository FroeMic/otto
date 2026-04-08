import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { executeLinearWorkspaceMemberInvite } from "./invite";

function buildUserNode(overrides: Record<string, unknown> = {}) {
  return {
    admin: false,
    avatarUrl: null,
    createdAt: "2026-04-08T07:00:00.000Z",
    description: null,
    displayName: "Otto AI Agent",
    email: "otto@example.com",
    guest: false,
    id: "user-1",
    isAssignable: true,
    isMentionable: true,
    lastSeen: null,
    name: "Otto AI Agent",
    owner: false,
    statusEmoji: null,
    statusLabel: null,
    statusUntilAt: null,
    updatedAt: "2026-04-08T09:00:00.000Z",
    url: "https://linear.app/otto/user/otto-ai-agent",
    ...overrides,
  };
}

function buildOrganizationInviteNode(overrides: Record<string, unknown> = {}) {
  return {
    acceptedAt: null,
    archivedAt: null,
    createdAt: "2026-04-08T08:00:00.000Z",
    email: "new.person@example.com",
    expiresAt: "2026-04-15T08:00:00.000Z",
    external: true,
    id: "invite-1",
    invitee: null,
    inviter: buildUserNode(),
    role: "user",
    updatedAt: "2026-04-08T08:00:00.000Z",
    ...overrides,
  };
}

function queueFetchResponses(responses: Array<Record<string, unknown>>) {
  const requestBodies: string[] = [];

  globalThis.fetch = (async (_input, init) => {
    requestBodies.push(String(init?.body ?? ""));
    const next = responses.shift();

    if (!next) {
      throw new Error("No queued Linear response left for test.");
    }

    return new Response(JSON.stringify(next), {
      headers: {
        "Content-Type": "application/json",
      },
      status: 200,
    });
  }) as typeof fetch;

  return requestBodies;
}

describe("linear workspace member commands", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("invites one workspace member with optional role and team ids", async () => {
    const requestBodies = queueFetchResponses([
      {
        data: {
          organizationInviteCreate: {
            lastSyncId: 130,
            organizationInvite: buildOrganizationInviteNode(),
            success: true,
          },
        },
      },
    ]);

    const result = (await executeLinearWorkspaceMemberInvite({
      arguments: {
        email: " new.person@example.com ",
        role: "guest",
        teamIds: ["team-1", " team-2 "],
      },
      context: {
        auth: { accessToken: "token" } as never,
        tenantIntegrationId: "tenant-integration-1",
      },
    })) as {
      commandKey: string;
      invite: {
        email: string | null;
        id: string | null;
        role: string | null;
      } | null;
      lastSyncId: number | null;
      lookup: string;
      success: boolean;
    };

    const payload = JSON.parse(requestBodies[0] ?? "{}") as {
      query: string;
      variables: {
        input: Record<string, unknown>;
      };
    };

    assert.match(payload.query, /mutation OttoLinearOrganizationInviteCreate/);
    assert.deepEqual(payload.variables.input, {
      email: "new.person@example.com",
      role: "guest",
      teamIds: ["team-1", "team-2"],
    });
    assert.equal(result.commandKey, "workspace_member.invite");
    assert.equal(result.lastSyncId, 130);
    assert.equal(result.lookup, "new.person@example.com");
    assert.equal(result.success, true);
    assert.equal(result.invite?.id, "invite-1");
    assert.equal(result.invite?.email, "new.person@example.com");
    assert.equal(result.invite?.role, "user");
  });
});

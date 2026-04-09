import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseSlackIngressRequest } from "./slack-ingress";

describe("parseSlackIngressRequest", () => {
  it("returns a direct challenge response for Slack url verification", () => {
    const parsed = parseSlackIngressRequest({
      body: JSON.stringify({
        challenge: "abc123",
        team_id: "T123",
        type: "url_verification",
      }),
      requestType: "events",
    });

    assert.equal(parsed.teamId, "T123");
    assert.deepEqual(parsed.directResponse, {
      body: "abc123",
      contentType: "text/plain; charset=utf-8",
      status: 200,
    });
  });

  it("extracts team and enterprise ids from slash commands", () => {
    const parsed = parseSlackIngressRequest({
      body: new URLSearchParams({
        command: "/openclaw",
        enterprise_id: "E123",
        team_id: "T123",
        text: "hello",
      }).toString(),
      requestType: "commands",
    });

    assert.equal(parsed.enterpriseId, "E123");
    assert.equal(parsed.teamId, "T123");
    assert.equal(parsed.directResponse, undefined);
  });

  it("extracts nested team ids from interactive payloads", () => {
    const parsed = parseSlackIngressRequest({
      body: new URLSearchParams({
        payload: JSON.stringify({
          team: {
            id: "T999",
          },
          type: "block_actions",
          user: {
            id: "U123",
          },
        }),
      }).toString(),
      requestType: "interactivity",
    });

    assert.equal(parsed.teamId, "T999");
    assert.equal(parsed.enterpriseId, null);
  });
});

import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "https://example.com/db";
process.env.CONTROL_PLANE_ENCRYPTION_SECRET ??= "test-encryption-secret";
process.env.CONTROL_PLANE_OAUTH_STATE_SECRET ??= "test-oauth-state-secret";
process.env.CONTROL_PLANE_DOMAIN = "app.example.com";
process.env.WORKOS_BASE_URL = "https://app.example.com";
process.env.LINEAR_CLIENT_ID ??= "linear-client-id";
process.env.LINEAR_CLIENT_SECRET ??= "linear-client-secret";
process.env.LINEAR_REDIRECT_URI ??=
  "https://app.example.com/oauth/callback/integration/linear";
process.env.LINEAR_OAUTH_ACTOR ??= "app";
process.env.LINEAR_OAUTH_SCOPES ??= "read,write,app:mentionable";
process.env.SLACK_CLIENT_ID ??= "slack-client-id";
process.env.SLACK_CLIENT_SECRET ??= "slack-client-secret";
process.env.SLACK_REDIRECT_URI =
  "https://app.example.com/oauth/callback/integration/slack";
process.env.SLACK_BOT_SCOPES ??= "chat:write,channels:read";

import { slackOAuthProvider } from "@/integrations/library/slack/oauth/provider";
import { listOAuthProviderKeys } from "@/lib/oauth/providers";
import { linearOAuthProvider } from "@/lib/oauth/providers/linear";
import {
  createPkcePair,
  signManagedIntegrationOAuthState,
  verifyManagedIntegrationOAuthState,
} from "@/lib/oauth/state";

test("managed integration oauth state round-trips", () => {
  const encoded = signManagedIntegrationOAuthState({
    nonce: "nonce-123",
    provider: "linear",
    sessionId: "session-123",
  });

  assert.deepEqual(verifyManagedIntegrationOAuthState(encoded), {
    nonce: "nonce-123",
    provider: "linear",
    sessionId: "session-123",
  });
});

test("pkce pair produces verifier and challenge", () => {
  const pkce = createPkcePair();

  assert.ok(pkce.verifier.length > 20);
  assert.ok(pkce.challenge.length > 20);
  assert.notEqual(pkce.verifier, pkce.challenge);
});

test("linear oauth provider builds actor=app authorization url", () => {
  const authorizeUrl = new URL(
    linearOAuthProvider.buildAuthorizationUrl({
      codeChallenge: "challenge-value",
      state: "signed-state",
    }),
  );

  assert.equal(authorizeUrl.origin, "https://linear.app");
  assert.equal(authorizeUrl.pathname, "/oauth/authorize");
  assert.equal(authorizeUrl.searchParams.get("actor"), "app");
  assert.equal(authorizeUrl.searchParams.get("response_type"), "code");
  assert.equal(
    authorizeUrl.searchParams.get("scope"),
    "read,write,app:mentionable",
  );
  assert.equal(
    authorizeUrl.searchParams.get("code_challenge"),
    "challenge-value",
  );
  assert.equal(authorizeUrl.searchParams.get("code_challenge_method"), "S256");
});

test("linear oauth provider classifies invalid grant as reauthorize", () => {
  assert.equal(
    linearOAuthProvider.classifyError({
      code: "invalid_grant",
    }),
    "reauthorize",
  );
});

test("slack oauth provider builds managed integration authorization url", () => {
  const authorizeUrl = new URL(
    slackOAuthProvider.buildAuthorizationUrl({
      codeChallenge: null,
      state: "signed-state",
    }),
  );

  assert.equal(authorizeUrl.origin, "https://slack.com");
  assert.equal(authorizeUrl.pathname, "/oauth/v2/authorize");
  assert.equal(
    authorizeUrl.searchParams.get("redirect_uri"),
    "https://app.example.com/oauth/callback/integration/slack",
  );
  assert.equal(
    authorizeUrl.searchParams.get("scope"),
    "chat:write,channels:read",
  );
  assert.equal(authorizeUrl.searchParams.get("state"), "signed-state");
});

test("oauth provider registry includes slack", () => {
  assert.deepEqual(listOAuthProviderKeys(), ["linear", "slack"]);
});

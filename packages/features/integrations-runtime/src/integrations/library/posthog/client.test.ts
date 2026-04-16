import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  buildPostHogEnvironmentPath,
  buildPostHogProjectPath,
  normalizePostHogHost,
  prepareHogQlQuery,
  resolvePostHogTarget,
} from "./client";

describe("PostHog client helpers", () => {
  it("normalizes PostHog hosts to origins", () => {
    assert.equal(
      normalizePostHogHost(" https://us.posthog.com/ "),
      "https://us.posthog.com",
    );
    assert.equal(
      normalizePostHogHost("https://eu.posthog.com"),
      "https://eu.posthog.com",
    );
  });

  it("rejects host URLs with paths or insecure protocols", () => {
    assert.throws(
      () => normalizePostHogHost("https://us.posthog.com/project/1"),
      /origin without a path/,
    );
    assert.throws(
      () => normalizePostHogHost("http://posthog.local"),
      /https/,
    );
  });

  it("resolves explicit, keyed, and default targets", () => {
    const state = {
      defaultTargetKey: "production",
      host: "https://us.posthog.com",
      targets: [
        {
          environmentId: "env-prod",
          key: "production",
          label: "Production",
          organizationId: "org-1",
          projectId: "project-1",
        },
      ],
    };

    assert.equal(
      resolvePostHogTarget({
        arguments: {},
        state,
      }).environmentId,
      "env-prod",
    );
    assert.equal(
      resolvePostHogTarget({
        arguments: {
          targetKey: "production",
        },
        state,
      }).projectId,
      "project-1",
    );
    assert.equal(
      resolvePostHogTarget({
        arguments: {
          environmentId: "env-explicit",
          projectId: "project-explicit",
        },
        state,
      }).environmentId,
      "env-explicit",
    );
  });

  it("builds project and environment endpoint paths explicitly", () => {
    assert.equal(
      buildPostHogProjectPath("123", "/feature_flags/"),
      "/api/projects/123/feature_flags/",
    );
    assert.equal(
      buildPostHogEnvironmentPath("456", "query/"),
      "/api/environments/456/query/",
    );
  });

  it("keeps HogQL read-only and bounded", () => {
    assert.equal(
      prepareHogQlQuery("select event from events", 25).query,
      "select event from events limit 25",
    );
    assert.throws(
      () => prepareHogQlQuery("delete from events", 10),
      /read-only/,
    );
    assert.throws(
      () => prepareHogQlQuery("select 1; select 2", 10),
      /single statement/,
    );
    assert.throws(
      () => prepareHogQlQuery("select event from events", 501),
      /no more than 500/,
    );
  });
});

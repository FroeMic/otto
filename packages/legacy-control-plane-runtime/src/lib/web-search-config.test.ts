import assert from "node:assert/strict";
import test from "node:test";

import { __testing as envTesting } from "./env";
import { resolveRuntimeWebSearchConfig } from "./web-search-config";

test("resolveRuntimeWebSearchConfig no longer projects provider secrets into tenant runtime env", () => {
  const previousProvider = process.env.RUNTIME_WEB_SEARCH_PROVIDER;
  const previousBraveMode = process.env.RUNTIME_WEB_SEARCH_BRAVE_MODE;
  const previousBraveApiKey = process.env.RUNTIME_BRAVE_API_KEY;

  process.env.RUNTIME_WEB_SEARCH_PROVIDER = "brave";
  process.env.RUNTIME_WEB_SEARCH_BRAVE_MODE = "web";
  process.env.RUNTIME_BRAVE_API_KEY = "test-brave-key";
  envTesting.resetEnvCacheForTests();

  try {
    const resolved = resolveRuntimeWebSearchConfig();

    assert.equal(resolved.enabled, true);
    assert.deepEqual(resolved.envLines, []);
    assert.equal(resolved.openClawConfig?.provider, "brave");
  } finally {
    if (previousProvider === undefined) {
      delete process.env.RUNTIME_WEB_SEARCH_PROVIDER;
    } else {
      process.env.RUNTIME_WEB_SEARCH_PROVIDER = previousProvider;
    }

    if (previousBraveMode === undefined) {
      delete process.env.RUNTIME_WEB_SEARCH_BRAVE_MODE;
    } else {
      process.env.RUNTIME_WEB_SEARCH_BRAVE_MODE = previousBraveMode;
    }

    if (previousBraveApiKey === undefined) {
      delete process.env.RUNTIME_BRAVE_API_KEY;
    } else {
      process.env.RUNTIME_BRAVE_API_KEY = previousBraveApiKey;
    }

    envTesting.resetEnvCacheForTests();
  }
});

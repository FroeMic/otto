import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = process.cwd();
const CADDYFILE_PATH = path.join(WEB_ROOT, "Caddyfile");
const COMPOSE_PATH = path.join(WEB_ROOT, "docker-compose.prod.yml");

describe("production routing audit", () => {
  it("sends landing traffic to frontend instead of legacy www", () => {
    const caddyfile = readFileSync(CADDYFILE_PATH, "utf8");

    assert.match(
      caddyfile,
      /\{\$LANDING_PAGE_DOMAIN\}\s*\{[\s\S]*?reverse_proxy frontend:3000/,
      "Landing domain must proxy to frontend:3000 in web/Caddyfile",
    );

    assert.doesNotMatch(
      caddyfile,
      /\{\$LANDING_PAGE_DOMAIN\}\s*\{[\s\S]*?reverse_proxy www:3000/,
      "Landing domain must not proxy to legacy www:3000 in web/Caddyfile",
    );
  });

  it("keeps legacy www behind the rollback-only compose profile", () => {
    const compose = readFileSync(COMPOSE_PATH, "utf8");

    assert.match(
      compose,
      /(^|\n)  www:\n[\s\S]*?profiles:\s*\["legacy-www"\]/,
      "Legacy www service must stay behind the legacy-www profile",
    );
  });
});

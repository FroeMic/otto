import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = process.cwd();
const CADDYFILE_PATH = path.join(WEB_ROOT, "Caddyfile");
const COMPOSE_PATH = path.join(WEB_ROOT, "docker-compose.prod.yml");

function getServiceBlock(compose: string, serviceName: string) {
  const pattern = new RegExp(
    `(^|\\n)  ${serviceName}:\\n([\\s\\S]*?)(?=\\n  [a-z0-9-]+:|\\nvolumes:|$)`,
  );
  const match = compose.match(pattern);

  assert.ok(match, `Could not find ${serviceName} service block in production compose`);

  return match[0];
}

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
    const wwwService = getServiceBlock(compose, "www");

    assert.match(
      wwwService,
      /profiles:\s*\["legacy-www"\]/,
      "Legacy www service must stay behind the legacy-www profile",
    );
  });

  it("runs integration-gateway from apps/gateway while keeping the same service boundary", () => {
    const compose = readFileSync(COMPOSE_PATH, "utf8");
    const gatewayService = getServiceBlock(compose, "integration-gateway");

    assert.match(
      gatewayService,
      /dockerfile:\s+apps\/gateway\/Dockerfile/,
      "integration-gateway must build from apps/gateway/Dockerfile in production compose",
    );

    assert.match(
      gatewayService,
      /image:\s+\$\{OTTO_GATEWAY_IMAGE:-otto-control-plane-gateway:local\}/,
      "integration-gateway must publish a dedicated gateway image tag in production compose",
    );

    assert.doesNotMatch(
      gatewayService,
      /dockerfile:\s+web\/Dockerfile/,
      "integration-gateway must not keep building from web/Dockerfile in production compose",
    );

    assert.doesNotMatch(
      gatewayService,
      /image:\s+\$\{OTTO_IMAGE:-otto-control-plane:local\}/,
      "integration-gateway must not keep reusing the legacy web image tag in production compose",
    );

    assert.doesNotMatch(
      gatewayService,
      /command:\s+\["bun",\s+"src\/integration-gateway\/server\.ts"\]/,
      "integration-gateway must not keep using the legacy web gateway entrypoint in production compose",
    );
  });
});

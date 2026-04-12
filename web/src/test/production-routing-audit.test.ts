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

  assert.ok(
    match,
    `Could not find ${serviceName} service block in production compose`,
  );

  return match[0];
}

describe("production routing audit", () => {
  it("routes the apex domain to web, api, and gateway", () => {
    const caddyfile = readFileSync(CADDYFILE_PATH, "utf8");

    assert.match(
      caddyfile,
      /\{\$LANDING_PAGE_DOMAIN\}\s*\{[\s\S]*?handle \/api\/internal\/runtime\/integrations\/execute\* \{[\s\S]*?reverse_proxy integration-gateway:3001/,
      "Apex domain must send integration execute traffic to integration-gateway:3001 in web/Caddyfile",
    );

    assert.match(
      caddyfile,
      /\{\$LANDING_PAGE_DOMAIN\}\s*\{[\s\S]*?handle \/api\/\* \{[\s\S]*?reverse_proxy api:3002/,
      "Apex domain must send /api/* traffic to api:3002 in web/Caddyfile",
    );

    assert.match(
      caddyfile,
      /\{\$LANDING_PAGE_DOMAIN\}\s*\{[\s\S]*?reverse_proxy web:3000/,
      "Apex domain must default to web:3000 in web/Caddyfile",
    );

    assert.doesNotMatch(
      caddyfile,
      /\{\$LANDING_PAGE_DOMAIN\}\s*\{[\s\S]*?reverse_proxy www:3000/,
      "Apex domain must not proxy to legacy www:3000 in web/Caddyfile",
    );
  });

  it("does not keep a secondary workspace hostname block in caddy", () => {
    const caddyfile = readFileSync(CADDYFILE_PATH, "utf8");

    assert.doesNotMatch(
      caddyfile,
      /\{\$CONTROL_PLANE_DOMAIN\}\s*\{/,
      "Production Caddy must not keep a secondary CONTROL_PLANE_DOMAIN host block",
    );
  });

  it("does not keep the legacy www service in production compose", () => {
    const compose = readFileSync(COMPOSE_PATH, "utf8");

    assert.doesNotMatch(
      compose,
      /(^|\n) {2}www:\n/,
      "Legacy www service must be removed from production compose",
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

  it("runs the extracted api service in production compose", () => {
    const compose = readFileSync(COMPOSE_PATH, "utf8");
    const apiService = getServiceBlock(compose, "api");

    assert.match(
      apiService,
      /dockerfile:\s+apps\/api\/Dockerfile/,
      "api must build from apps/api/Dockerfile in production compose",
    );

    assert.match(
      apiService,
      /API_PORT:\s+3002/,
      "api must expose API_PORT 3002 in production compose",
    );
  });

  it("points the web service at the extracted api and unified apex origin", () => {
    const compose = readFileSync(COMPOSE_PATH, "utf8");
    const webService = getServiceBlock(compose, "web");

    assert.match(
      webService,
      /API_ORIGIN:\s+http:\/\/api:3002/,
      "web must proxy /api traffic to api:3002 in production compose",
    );

    assert.match(
      webService,
      /WORKSPACE_APP_ORIGIN:\s+https:\/\/\$\{LANDING_PAGE_DOMAIN\}/,
      "web must treat the apex landing domain as the workspace origin in production compose",
    );
  });

  it("points the api service at the unified apex origin", () => {
    const compose = readFileSync(COMPOSE_PATH, "utf8");
    const apiService = getServiceBlock(compose, "api");

    assert.match(
      apiService,
      /WORKSPACE_APP_ORIGIN:\s+https:\/\/\$\{LANDING_PAGE_DOMAIN\}/,
      "api must treat the landing domain as the public workspace origin in production compose",
    );
  });

  it("runs worker from apps/worker with a dedicated Bun image", () => {
    const compose = readFileSync(COMPOSE_PATH, "utf8");
    const workerService = getServiceBlock(compose, "worker");

    assert.match(
      workerService,
      /dockerfile:\s+apps\/worker\/Dockerfile/,
      "worker must build from apps/worker/Dockerfile in production compose",
    );

    assert.match(
      workerService,
      /image:\s+\$\{OTTO_WORKER_IMAGE:-otto-control-plane-worker:local\}/,
      "worker must publish a dedicated worker image tag in production compose",
    );

    assert.doesNotMatch(
      workerService,
      /dockerfile:\s+web\/Dockerfile/,
      "worker must not keep building from web/Dockerfile in production compose",
    );

    assert.doesNotMatch(
      workerService,
      /image:\s+\$\{OTTO_IMAGE:-otto-control-plane:local\}/,
      "worker must not keep reusing the legacy web image tag in production compose",
    );

    assert.doesNotMatch(
      workerService,
      /command:\s+\["npm",\s+"run",\s+"worker"\]/,
      "worker must not keep using the legacy npm worker entrypoint in production compose",
    );
  });
});

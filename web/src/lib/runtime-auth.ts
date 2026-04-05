import { createHash } from "node:crypto";

import { getTenantByTenantToken } from "@/db/control-plane";

export async function authenticateTenantRuntimeRequest(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing runtime bearer token");
  }

  const tenantToken = authorization.slice("Bearer ".length).trim();

  if (!tenantToken) {
    throw new Error("Missing runtime bearer token");
  }

  const start = Date.now();
  const context = buildRuntimeAuthLogContext({ request, tenantToken });

  console.log(`[runtime-auth] looking up tenant token ${context}`);

  const tenant = await getTenantByTenantToken(tenantToken);
  const elapsed = Date.now() - start;

  if (!tenant) {
    console.log(
      `[runtime-auth] token lookup failed (no match) in ${elapsed}ms ${context}`,
    );
    throw new Error("Invalid runtime bearer token");
  }

  console.log(
    `[runtime-auth] authenticated tenant=${tenant.tenantId} in ${elapsed}ms ${context}`,
  );

  return tenant;
}

export function buildRuntimeAuthLogContext(input: {
  request: Pick<Request, "headers" | "method" | "url">;
  tenantToken: string;
}) {
  const url = parseRequestUrl(input.request.url);
  const path = url ? `${url.pathname}${url.search}` : input.request.url;
  const forwardedFor = firstForwardedAddress(input.request.headers);

  return serializeLogFields({
    contentType: normalizeHeaderValue(
      input.request.headers.get("content-type"),
    ),
    ip: forwardedFor,
    method: normalizeHeaderValue(input.request.method) ?? "UNKNOWN",
    path,
    tokenFingerprint: getTokenFingerprint(input.tenantToken),
    userAgent: normalizeHeaderValue(input.request.headers.get("user-agent")),
  });
}

function getTokenFingerprint(tenantToken: string) {
  return createHash("sha256").update(tenantToken).digest("hex").slice(0, 12);
}

function parseRequestUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function firstForwardedAddress(headers: Pick<Headers, "get">) {
  const forwardedFor = normalizeHeaderValue(headers.get("x-forwarded-for"));

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return normalizeHeaderValue(headers.get("x-real-ip"));
}

function normalizeHeaderValue(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized.slice(0, 160) : null;
}

function serializeLogFields(fields: Record<string, string | null>) {
  return Object.entries(fields)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
}

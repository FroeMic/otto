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
  console.log("[runtime-auth] looking up tenant token…");

  const tenant = await getTenantByTenantToken(tenantToken);
  const elapsed = Date.now() - start;

  if (!tenant) {
    console.log(
      `[runtime-auth] token lookup failed (no match) in ${elapsed}ms`,
    );
    throw new Error("Invalid runtime bearer token");
  }

  console.log(
    `[runtime-auth] authenticated tenant=${tenant.tenantId} in ${elapsed}ms`,
  );

  return tenant;
}

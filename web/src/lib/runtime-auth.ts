import { getTenantByRuntimeGatewayToken } from "@/db/control-plane";

export async function authenticateTenantRuntimeRequest(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing runtime bearer token");
  }

  const gatewayToken = authorization.slice("Bearer ".length).trim();

  if (!gatewayToken) {
    throw new Error("Missing runtime bearer token");
  }

  const tenant = await getTenantByRuntimeGatewayToken(gatewayToken);

  if (!tenant) {
    throw new Error("Invalid runtime bearer token");
  }

  return tenant;
}

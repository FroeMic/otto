import { eq } from "drizzle-orm";

import { getDb } from "../../db/client";
import { tenantServers, tenants } from "../../db/schema";
import { getEnv } from "../env";
import type { SshConnection } from "../ssh/client";

export async function getTenantRuntimeConnection(
  tenantId: string,
  context: string,
): Promise<SshConnection> {
  const db = getDb();
  const [tenantServer] = await db
    .select({
      ipv4: tenantServers.ipv4,
      serverStatus: tenantServers.status,
      sshUsername: tenantServers.sshUsername,
      tenantStatus: tenants.status,
    })
    .from(tenantServers)
    .innerJoin(tenants, eq(tenantServers.tenantId, tenants.id))
    .where(eq(tenantServers.tenantId, tenantId))
    .limit(1);

  if (!tenantServer?.ipv4) {
    throw new Error(`Tenant server IP is missing for ${context}`);
  }

  if (
    tenantServer.serverStatus !== "ready" ||
    tenantServer.tenantStatus !== "ready"
  ) {
    throw new Error(`${context} requires a ready tenant runtime`);
  }

  return {
    host: tenantServer.ipv4,
    port: getEnv().RUNTIME_SSH_PORT,
    username: tenantServer.sshUsername ?? getEnv().RUNTIME_SSH_USERNAME,
  };
}

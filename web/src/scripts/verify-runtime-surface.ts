import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getTenantRuntimeTenantToken } from "@/db/control-plane";
import { organizations, tenantServers, tenants } from "@/db/schema";
import { logCliError } from "@/lib/cli-error";
import { getControlPlaneBaseUrl } from "@/lib/env";

type TenantRuntimeTarget = {
  ipv4: string | null;
  status: string;
  tenantId: string;
  tenantName: string;
};

async function main() {
  const [orgSlug, surfaceKind, surfaceKey] = process.argv.slice(2);

  if (!orgSlug || !surfaceKind || !surfaceKey) {
    throw new Error(
      "Usage: tsx src/scripts/verify-runtime-surface.ts <org-slug> <surfaceKind> <surfaceKey>",
    );
  }

  const baseUrl = getControlPlaneBaseUrl();

  if (!baseUrl) {
    throw new Error(
      "Could not resolve the control-plane base URL from env. Set CONTROL_PLANE_DOMAIN or WORKOS_BASE_URL.",
    );
  }

  const target = await getLatestTenantForOrganization(orgSlug);

  if (!target) {
    throw new Error(`No tenant found for organization slug "${orgSlug}".`);
  }

  const tenantToken = await getTenantRuntimeTenantToken(target.tenantId);

  if (!tenantToken) {
    throw new Error(
      `Tenant ${target.tenantId} does not have a saved tenant token yet.`,
    );
  }

  const listResponse = await fetchRuntimeSurface({
    baseUrl,
    tenantToken,
    path: "/api/internal/runtime/surfaces",
  });
  const surfaceResponse = await fetchRuntimeSurface({
    baseUrl,
    tenantToken,
    path: `/api/internal/runtime/surfaces/${encodeURIComponent(surfaceKind)}/${encodeURIComponent(surfaceKey)}`,
  });

  console.log(
    JSON.stringify(
      {
        controlPlaneBaseUrl: baseUrl,
        requestedSurface: {
          key: surfaceKey,
          kind: surfaceKind,
        },
        tenant: target,
        toolConfigSurface: surfaceResponse,
        toolConfigSurfaceCount: Array.isArray(listResponse?.surfaces)
          ? listResponse.surfaces.length
          : null,
        toolConfigSurfaceIds: Array.isArray(listResponse?.surfaces)
          ? listResponse.surfaces.map((surface: { id?: string }) => surface.id)
          : [],
        verificationNotes: [
          "These responses are fetched with the tenant token against the same internal control-plane endpoints the otto-runtime-config plugin uses.",
          "If the custom Otto runtime image is deployed, the runtime plugin should expose matching surface data to the agent.",
        ],
      },
      null,
      2,
    ),
  );
}

async function getLatestTenantForOrganization(
  orgSlug: string,
): Promise<TenantRuntimeTarget | null> {
  const db = getDb();
  const [tenantRow] = await db
    .select({
      ipv4: tenantServers.ipv4,
      status: tenants.status,
      tenantId: tenants.id,
      tenantName: tenants.name,
    })
    .from(tenants)
    .innerJoin(organizations, eq(tenants.organizationId, organizations.id))
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(organizations.slug, orgSlug))
    .orderBy(desc(tenants.createdAt))
    .limit(1);

  return tenantRow ?? null;
}

async function fetchRuntimeSurface(input: {
  baseUrl: string;
  tenantToken: string;
  path: string;
}) {
  const response = await fetch(`${input.baseUrl}${input.path}`, {
    headers: {
      Authorization: `Bearer ${input.tenantToken}`,
    },
  });
  const text = await response.text();
  const body = tryParseJson(text);

  if (!response.ok) {
    throw new Error(
      `Runtime surface request failed (${response.status} ${response.statusText}) for ${input.path}: ${text}`,
    );
  }

  return body;
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

main().catch((error) => {
  logCliError(error);
  process.exit(1);
});

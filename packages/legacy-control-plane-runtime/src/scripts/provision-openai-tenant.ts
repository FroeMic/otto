import "dotenv/config";

import { desc, eq } from "drizzle-orm";

import { getDb } from "../db/client";
import {
  getProviderAccountByTenantAndKey,
  PROVIDER_CREDENTIAL_TYPES,
  persistProvisionedProviderCredential,
} from "../db/provider-accounts";
import { organizations, tenantServers, tenants } from "../db/schema";
import { logCliError } from "../lib/cli-error";
import { OpenAiProvisioner } from "../lib/providers/openai/provisioning";

type TenantTarget = {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
};

async function main() {
  const args = process.argv.slice(2);
  const options = parseOptions(args);
  const tenant = await getLatestTenantForOrganizationSlug(options.orgSlug);

  if (!tenant) {
    throw new Error(
      `No tenant found for organization slug "${options.orgSlug}".`,
    );
  }

  const existingAccount = await getProviderAccountByTenantAndKey(
    tenant.tenantId,
    "openai",
  );

  if (existingAccount && !options.rotate) {
    throw new Error(
      `Tenant ${tenant.tenantId} already has an OpenAI provider account. Re-run with --rotate to replace its active API key.`,
    );
  }

  const provisioner = new OpenAiProvisioner();
  const provisioned = await provisioner.createTenantCredential({
    existingProjectId: existingAccount?.externalProjectId ?? null,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    verify: !options.skipVerify,
  });

  const { providerAccount, providerCredential } =
    await persistProvisionedProviderCredential({
      credentialType: PROVIDER_CREDENTIAL_TYPES.apiKey,
      displayName: provisioned.displayName,
      externalApiKeyId: provisioned.apiKeyId,
      externalProjectId: provisioned.projectId,
      externalServiceAccountId: provisioned.serviceAccountId,
      plaintext: provisioned.apiKey,
      provisionedAt: new Date(),
      providerKey: provisioned.providerKey,
      revokedAt: null,
      status: "active",
      tenantId: tenant.tenantId,
    });

  console.info(
    JSON.stringify(
      {
        action: "provision-openai-tenant",
        note: "Run `bun run tenant:runtime:apply -- <org-slug>` to project the tenant-specific key into the runtime on the next apply.",
        organizationSlug: options.orgSlug,
        projectId: provisioned.projectId,
        providerAccountId: providerAccount.id,
        providerCredentialId: providerCredential.id,
        rotated: options.rotate,
        serviceAccountId: provisioned.serviceAccountId,
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        tenantStatus: tenant.tenantStatus,
        verified: !options.skipVerify,
      },
      null,
      2,
    ),
  );
}

function parseOptions(args: string[]) {
  let orgSlug: string | null = null;
  let rotate = false;
  let skipVerify = false;

  for (const arg of args) {
    if (arg === "--rotate") {
      rotate = true;
      continue;
    }

    if (arg === "--skip-verify") {
      skipVerify = true;
      continue;
    }

    if (!orgSlug) {
      orgSlug = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!orgSlug) {
    printUsage();
    process.exit(1);
  }

  return {
    orgSlug,
    rotate,
    skipVerify,
  };
}

async function getLatestTenantForOrganizationSlug(
  orgSlug: string,
): Promise<TenantTarget | null> {
  const db = getDb();
  const [tenant] = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantStatus: tenants.status,
    })
    .from(tenants)
    .innerJoin(organizations, eq(tenants.organizationId, organizations.id))
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(organizations.slug, orgSlug))
    .orderBy(desc(tenants.createdAt))
    .limit(1);

  return tenant ?? null;
}

function printUsage() {
  console.error(
    "Usage: bun src/scripts/provision-openai-tenant.ts <org-slug> [--rotate] [--skip-verify]",
  );
}

main().catch(logCliError);

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { tenantIntegrationCapabilityStates } from "@/db/schema";
import type { IntegrationCapabilityPolicy } from "@/integrations/framework";

export async function getTenantIntegrationCapabilityPolicy(input: {
  capabilityKey: string;
  tenantIntegrationId: string;
}): Promise<IntegrationCapabilityPolicy | null> {
  const db = getDb();
  const [row] = await db
    .select({
      policyJson: tenantIntegrationCapabilityStates.policyJson,
    })
    .from(tenantIntegrationCapabilityStates)
    .where(
      and(
        eq(
          tenantIntegrationCapabilityStates.tenantIntegrationId,
          input.tenantIntegrationId,
        ),
        eq(
          tenantIntegrationCapabilityStates.capabilityKey,
          input.capabilityKey,
        ),
      ),
    )
    .limit(1);

  return row?.policyJson ?? null;
}

export async function listTenantIntegrationCapabilityPolicies(input: {
  tenantIntegrationId: string;
}): Promise<Map<string, IntegrationCapabilityPolicy>> {
  const db = getDb();
  const rows = await db
    .select({
      capabilityKey: tenantIntegrationCapabilityStates.capabilityKey,
      policyJson: tenantIntegrationCapabilityStates.policyJson,
    })
    .from(tenantIntegrationCapabilityStates)
    .where(
      eq(
        tenantIntegrationCapabilityStates.tenantIntegrationId,
        input.tenantIntegrationId,
      ),
    );

  return new Map(
    rows.map((row) => [
      row.capabilityKey,
      row.policyJson as IntegrationCapabilityPolicy,
    ]),
  );
}

export async function upsertTenantIntegrationCapabilityPolicy(input: {
  capabilityKey: string;
  policy: IntegrationCapabilityPolicy;
  tenantIntegrationId: string;
}) {
  const db = getDb();

  if (input.policy.policy === "allow") {
    await db
      .delete(tenantIntegrationCapabilityStates)
      .where(
        and(
          eq(
            tenantIntegrationCapabilityStates.tenantIntegrationId,
            input.tenantIntegrationId,
          ),
          eq(
            tenantIntegrationCapabilityStates.capabilityKey,
            input.capabilityKey,
          ),
        ),
      );

    return;
  }

  await db
    .insert(tenantIntegrationCapabilityStates)
    .values({
      capabilityKey: input.capabilityKey,
      policyJson: input.policy,
      tenantIntegrationId: input.tenantIntegrationId,
    })
    .onConflictDoUpdate({
      target: [
        tenantIntegrationCapabilityStates.tenantIntegrationId,
        tenantIntegrationCapabilityStates.capabilityKey,
      ],
      set: {
        policyJson: input.policy,
        updatedAt: new Date(),
      },
    });
}

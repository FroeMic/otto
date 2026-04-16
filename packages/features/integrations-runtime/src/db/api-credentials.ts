import { and, eq } from "drizzle-orm";

import { getDb } from "./client";
import {
  integrationApiCredentials,
  tenantIntegrationState,
} from "./schema";
import {
  decryptControlPlaneSecret,
  encryptControlPlaneSecret,
} from "../lib/crypto";

export type ConnectedApiCredentialRecord = {
  apiKey: string;
  credentialId: string;
  declaredScopes: string[];
  externalAccountLabel: string | null;
  metadata: Record<string, unknown>;
  providerKey: string;
  state: Record<string, unknown>;
  stateVersion: number | null;
  status: string;
  tenantIntegrationId: string;
};

export function normalizeApiCredentialScopes(scopes: string[]) {
  return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function joinScopeCsv(scopes: string[]) {
  return normalizeApiCredentialScopes(scopes).join(",");
}

function splitScopeCsv(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return normalizeApiCredentialScopes(value.split(","));
}

export async function upsertApiCredentialForTenantIntegration(input: {
  apiKey: string;
  credentialType: "personal_api_key" | (string & {});
  declaredScopes: string[];
  externalAccountLabel?: string | null;
  lastValidatedAt?: Date | null;
  metadata?: Record<string, unknown>;
  providerKey: string;
  tenantIntegrationId: string;
}) {
  const db = getDb();
  const now = new Date();

  await db
    .insert(integrationApiCredentials)
    .values({
      credentialType: input.credentialType,
      declaredScopesCsv: joinScopeCsv(input.declaredScopes),
      externalAccountLabel: input.externalAccountLabel ?? null,
      lastError: null,
      lastErrorAt: null,
      lastValidatedAt: input.lastValidatedAt ?? now,
      metadataJson: input.metadata ?? {},
      providerKey: input.providerKey,
      secretCiphertext: encryptControlPlaneSecret(input.apiKey),
      status: "connected",
      tenantIntegrationId: input.tenantIntegrationId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        credentialType: input.credentialType,
        declaredScopesCsv: joinScopeCsv(input.declaredScopes),
        externalAccountLabel: input.externalAccountLabel ?? null,
        lastError: null,
        lastErrorAt: null,
        lastValidatedAt: input.lastValidatedAt ?? now,
        metadataJson: input.metadata ?? {},
        providerKey: input.providerKey,
        secretCiphertext: encryptControlPlaneSecret(input.apiKey),
        status: "connected",
        updatedAt: now,
      },
      target: integrationApiCredentials.tenantIntegrationId,
    });
}

export async function upsertTenantIntegrationState(input: {
  providerKey: string;
  state: Record<string, unknown>;
  tenantIntegrationId: string;
}) {
  const db = getDb();
  const now = new Date();

  await db
    .insert(tenantIntegrationState)
    .values({
      providerKey: input.providerKey,
      stateJson: input.state,
      tenantIntegrationId: input.tenantIntegrationId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        providerKey: input.providerKey,
        stateJson: input.state,
        stateVersion: 1,
        updatedAt: now,
      },
      target: tenantIntegrationState.tenantIntegrationId,
    });
}

export async function getConnectedApiCredentialForTenantIntegration(input: {
  providerKey: string;
  tenantIntegrationId: string;
}): Promise<ConnectedApiCredentialRecord | null> {
  const db = getDb();
  const [row] = await db
    .select({
      credentialId: integrationApiCredentials.id,
      declaredScopesCsv: integrationApiCredentials.declaredScopesCsv,
      externalAccountLabel: integrationApiCredentials.externalAccountLabel,
      metadata: integrationApiCredentials.metadataJson,
      providerKey: integrationApiCredentials.providerKey,
      secretCiphertext: integrationApiCredentials.secretCiphertext,
      stateJson: tenantIntegrationState.stateJson,
      stateVersion: tenantIntegrationState.stateVersion,
      status: integrationApiCredentials.status,
      tenantIntegrationId: integrationApiCredentials.tenantIntegrationId,
    })
    .from(integrationApiCredentials)
    .innerJoin(
      tenantIntegrationState,
      eq(
        tenantIntegrationState.tenantIntegrationId,
        integrationApiCredentials.tenantIntegrationId,
      ),
    )
    .where(
      and(
        eq(
          integrationApiCredentials.tenantIntegrationId,
          input.tenantIntegrationId,
        ),
        eq(integrationApiCredentials.providerKey, input.providerKey),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    apiKey: decryptControlPlaneSecret(row.secretCiphertext),
    credentialId: row.credentialId,
    declaredScopes: splitScopeCsv(row.declaredScopesCsv),
    externalAccountLabel: row.externalAccountLabel,
    metadata: row.metadata ?? {},
    providerKey: row.providerKey,
    state: row.stateJson ?? {},
    stateVersion: row.stateVersion ?? null,
    status: row.status,
    tenantIntegrationId: row.tenantIntegrationId,
  };
}

export async function recordApiCredentialAttention(input: {
  credentialId: string;
  errorMessage: string;
}) {
  const db = getDb();
  const now = new Date();

  await db
    .update(integrationApiCredentials)
    .set({
      lastError: input.errorMessage,
      lastErrorAt: now,
      status: "needs_attention",
      updatedAt: now,
    })
    .where(eq(integrationApiCredentials.id, input.credentialId));
}

export async function disconnectApiCredentialForTenantIntegration(input: {
  providerKey: string;
  tenantIntegrationId: string;
}) {
  const db = getDb();
  const now = new Date();

  await db
    .delete(integrationApiCredentials)
    .where(
      and(
        eq(
          integrationApiCredentials.tenantIntegrationId,
          input.tenantIntegrationId,
        ),
        eq(integrationApiCredentials.providerKey, input.providerKey),
      ),
    );

  await db
    .update(tenantIntegrationState)
    .set({
      updatedAt: now,
    })
    .where(
      and(
        eq(tenantIntegrationState.tenantIntegrationId, input.tenantIntegrationId),
        eq(tenantIntegrationState.providerKey, input.providerKey),
      ),
    );
}

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db/client";
import { providerAccounts, providerCredentials } from "@/db/schema";
import {
  decryptControlPlaneSecret,
  encryptControlPlaneSecret,
} from "@/lib/crypto";
import type { ProviderKey } from "@/lib/providers/types";

export const PROVIDER_CREDENTIAL_TYPES = {
  apiKey: "api_key",
} as const;

export type ProviderCredentialType =
  (typeof PROVIDER_CREDENTIAL_TYPES)[keyof typeof PROVIDER_CREDENTIAL_TYPES];

export async function getProviderAccountByTenantAndKey(
  tenantId: string,
  providerKey: ProviderKey,
) {
  const db = getDb();
  const [account] = await db
    .select()
    .from(providerAccounts)
    .where(
      and(
        eq(providerAccounts.tenantId, tenantId),
        eq(providerAccounts.providerKey, providerKey),
      ),
    )
    .limit(1);

  return account ?? null;
}

export async function upsertProviderAccount(input: {
  tenantId: string;
  providerKey: ProviderKey;
  displayName?: string | null;
  externalProjectId?: string | null;
  externalServiceAccountId?: string | null;
  externalApiKeyId?: string | null;
  status: string;
  provisionedAt?: Date | null;
  revokedAt?: Date | null;
}) {
  const db = getDb();
  const now = new Date();
  const existingAccount = await getProviderAccountByTenantAndKey(
    input.tenantId,
    input.providerKey,
  );

  if (existingAccount) {
    const [updatedAccount] = await db
      .update(providerAccounts)
      .set({
        displayName: input.displayName ?? existingAccount.displayName,
        externalApiKeyId:
          input.externalApiKeyId ?? existingAccount.externalApiKeyId,
        externalProjectId:
          input.externalProjectId ?? existingAccount.externalProjectId,
        externalServiceAccountId:
          input.externalServiceAccountId ??
          existingAccount.externalServiceAccountId,
        provisionedAt: input.provisionedAt ?? existingAccount.provisionedAt,
        revokedAt: input.revokedAt ?? existingAccount.revokedAt,
        status: input.status,
        updatedAt: now,
      })
      .where(eq(providerAccounts.id, existingAccount.id))
      .returning();

    return updatedAccount;
  }

  const [createdAccount] = await db
    .insert(providerAccounts)
    .values({
      displayName: input.displayName ?? null,
      externalApiKeyId: input.externalApiKeyId ?? null,
      externalProjectId: input.externalProjectId ?? null,
      externalServiceAccountId: input.externalServiceAccountId ?? null,
      provisionedAt: input.provisionedAt ?? null,
      providerKey: input.providerKey,
      revokedAt: input.revokedAt ?? null,
      status: input.status,
      tenantId: input.tenantId,
    })
    .returning();

  return createdAccount;
}

export async function storeProviderCredential(input: {
  providerAccountId: string;
  credentialType: ProviderCredentialType;
  plaintext: string;
}) {
  const db = getDb();
  const now = new Date();
  const ciphertext = encryptControlPlaneSecret(input.plaintext);
  const [existingCredential] = await db
    .select()
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.providerAccountId, input.providerAccountId),
        eq(providerCredentials.credentialType, input.credentialType),
      ),
    )
    .limit(1);

  if (existingCredential) {
    const [updatedCredential] = await db
      .update(providerCredentials)
      .set({
        ciphertext,
        keyVersion: existingCredential.keyVersion + 1,
        revokedAt: null,
        rotatedAt: now,
      })
      .where(eq(providerCredentials.id, existingCredential.id))
      .returning();

    return updatedCredential;
  }

  const [createdCredential] = await db
    .insert(providerCredentials)
    .values({
      ciphertext,
      credentialType: input.credentialType,
      providerAccountId: input.providerAccountId,
    })
    .returning();

  return createdCredential;
}

export async function getProviderCredentialPlaintext(input: {
  providerKey: ProviderKey;
  tenantId: string;
  credentialType: ProviderCredentialType;
}) {
  const db = getDb();
  const [credential] = await db
    .select({
      ciphertext: providerCredentials.ciphertext,
    })
    .from(providerCredentials)
    .innerJoin(
      providerAccounts,
      eq(providerCredentials.providerAccountId, providerAccounts.id),
    )
    .where(
      and(
        eq(providerAccounts.tenantId, input.tenantId),
        eq(providerAccounts.providerKey, input.providerKey),
        eq(providerCredentials.credentialType, input.credentialType),
        isNull(providerCredentials.revokedAt),
        isNull(providerAccounts.revokedAt),
      ),
    )
    .limit(1);

  if (!credential?.ciphertext) {
    return null;
  }

  return decryptControlPlaneSecret(credential.ciphertext);
}

export async function getTenantOpenAiApiKey(tenantId: string) {
  return getProviderCredentialPlaintext({
    credentialType: PROVIDER_CREDENTIAL_TYPES.apiKey,
    providerKey: "openai",
    tenantId,
  });
}

import { and, desc, eq, isNull } from "drizzle-orm";

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
  externalApiKeyId?: string | null;
  externalServiceAccountId?: string | null;
  plaintext: string;
}) {
  const db = getDb();
  const ciphertext = encryptControlPlaneSecret(input.plaintext);

  const [createdCredential] = await db
    .insert(providerCredentials)
    .values({
      ciphertext,
      credentialType: input.credentialType,
      externalApiKeyId: input.externalApiKeyId ?? null,
      externalServiceAccountId: input.externalServiceAccountId ?? null,
      providerAccountId: input.providerAccountId,
    })
    .returning();

  return createdCredential;
}

export async function revokeActiveProviderCredentials(input: {
  providerAccountId: string;
  credentialType: ProviderCredentialType;
}) {
  const db = getDb();
  const now = new Date();

  await db
    .update(providerCredentials)
    .set({
      revokedAt: now,
      rotatedAt: now,
    })
    .where(
      and(
        eq(providerCredentials.providerAccountId, input.providerAccountId),
        eq(providerCredentials.credentialType, input.credentialType),
        isNull(providerCredentials.revokedAt),
      ),
    );
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
    .orderBy(desc(providerCredentials.createdAt))
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

export async function getTenantOpenAiProviderSummary(tenantId: string) {
  const db = getDb();
  const providerAccount = await getProviderAccountByTenantAndKey(
    tenantId,
    "openai",
  );

  if (!providerAccount) {
    return null;
  }

  const credentialRows = await db
    .select({
      createdAt: providerCredentials.createdAt,
      externalApiKeyId: providerCredentials.externalApiKeyId,
      externalServiceAccountId: providerCredentials.externalServiceAccountId,
      revokedAt: providerCredentials.revokedAt,
    })
    .from(providerCredentials)
    .where(eq(providerCredentials.providerAccountId, providerAccount.id))
    .orderBy(desc(providerCredentials.createdAt));

  const activeCredential =
    credentialRows.find((credential) => credential.revokedAt === null) ?? null;

  return {
    activeApiKeyId: activeCredential?.externalApiKeyId ?? null,
    activeCredentialCount: credentialRows.filter(
      (credential) => credential.revokedAt === null,
    ).length,
    activeServiceAccountId: activeCredential?.externalServiceAccountId ?? null,
    latestCredentialCreatedAt: credentialRows[0]?.createdAt ?? null,
    projectId: providerAccount.externalProjectId,
    status: providerAccount.status,
    totalCredentialCount: credentialRows.length,
  };
}

export async function persistProvisionedProviderCredential(input: {
  tenantId: string;
  providerKey: ProviderKey;
  displayName?: string | null;
  externalProjectId?: string | null;
  externalServiceAccountId?: string | null;
  externalApiKeyId?: string | null;
  status: string;
  provisionedAt?: Date | null;
  revokedAt?: Date | null;
  credentialType: ProviderCredentialType;
  plaintext: string;
}) {
  const db = getDb();
  const now = new Date();
  const ciphertext = encryptControlPlaneSecret(input.plaintext);

  return db.transaction(async (tx) => {
    const [existingAccount] = await tx
      .select()
      .from(providerAccounts)
      .where(
        and(
          eq(providerAccounts.tenantId, input.tenantId),
          eq(providerAccounts.providerKey, input.providerKey),
        ),
      )
      .limit(1);

    const providerAccount = existingAccount
      ? (
          await tx
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
              provisionedAt:
                input.provisionedAt ?? existingAccount.provisionedAt,
              revokedAt: input.revokedAt ?? existingAccount.revokedAt,
              status: input.status,
              updatedAt: now,
            })
            .where(eq(providerAccounts.id, existingAccount.id))
            .returning()
        )[0]
      : (
          await tx
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
            .returning()
        )[0];

    await tx
      .update(providerCredentials)
      .set({
        revokedAt: now,
        rotatedAt: now,
      })
      .where(
        and(
          eq(providerCredentials.providerAccountId, providerAccount.id),
          eq(providerCredentials.credentialType, input.credentialType),
          isNull(providerCredentials.revokedAt),
        ),
      );

    const [providerCredential] = await tx
      .insert(providerCredentials)
      .values({
        ciphertext,
        credentialType: input.credentialType,
        externalApiKeyId: input.externalApiKeyId ?? null,
        externalServiceAccountId: input.externalServiceAccountId ?? null,
        providerAccountId: providerAccount.id,
      })
      .returning();

    return {
      providerAccount,
      providerCredential,
    };
  });
}

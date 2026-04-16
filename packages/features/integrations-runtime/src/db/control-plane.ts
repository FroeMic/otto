import { createHash, timingSafeEqual } from "node:crypto"
import { and, eq } from "drizzle-orm"

import { decryptControlPlaneSecret } from "../lib/crypto"

import { getDb } from "./client"
import { tenantRuntimeSecrets } from "./schema"

const TENANT_TOKEN_SECRET_TYPE = "tenant_token"

export async function getTenantByTenantToken(tenantToken: string) {
  const db = getDb()
  const lookupHash = createTokenLookupHash(tenantToken)
  const [secret] = await db
    .select({
      ciphertext: tenantRuntimeSecrets.ciphertext,
      tenantId: tenantRuntimeSecrets.tenantId,
    })
    .from(tenantRuntimeSecrets)
    .where(
      and(
        eq(tenantRuntimeSecrets.secretType, TENANT_TOKEN_SECRET_TYPE),
        eq(tenantRuntimeSecrets.lookupHash, lookupHash),
      ),
    )
    .limit(1)

  if (!secret?.ciphertext) {
    return null
  }

  const storedToken = decryptControlPlaneSecret(secret.ciphertext)

  if (!tokensMatch(storedToken, tenantToken)) {
    return null
  }

  return {
    tenantId: secret.tenantId,
  }
}

function createTokenLookupHash(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function tokensMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

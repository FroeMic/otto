import crypto from "node:crypto"

import { authenticateTenantRuntimeRequest as authenticateTenantRuntimeRequestWithPackage } from "@otto/auth"
import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { tenantRuntimeSecrets } from "@otto/feature-integrations-runtime/db/schema"
import { decryptControlPlaneSecret } from "@otto/feature-integrations-runtime/lib/crypto"
import { and, eq } from "drizzle-orm"

import { isRuntimeDebugLoggingEnabled } from "./debug-logging"

const TENANT_TOKEN_SECRET_TYPE = "tenant_token"

function createTokenLookupHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

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
  const storedBuffer = Buffer.from(storedToken)
  const requestBuffer = Buffer.from(tenantToken)

  if (
    storedBuffer.length !== requestBuffer.length ||
    !crypto.timingSafeEqual(storedBuffer, requestBuffer)
  ) {
    return null
  }

  return {
    tenantId: secret.tenantId,
  }
}

export async function authenticateTenantRuntimeRequest(request: Request) {
  return authenticateTenantRuntimeRequestWithPackage({
    getTenantByTenantToken,
    log: isRuntimeDebugLoggingEnabled()
      ? (message) => {
          console.debug(message)
        }
      : undefined,
    request,
    resolveTenantId: (tenant) => tenant.tenantId,
  })
}

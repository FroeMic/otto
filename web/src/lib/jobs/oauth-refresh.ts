import {
  applyOauthRefreshSuccess,
  claimOauthConnectionForRefresh,
  listOauthConnectionsNeedingRefresh,
  recordOauthRefreshFailure,
} from "@/db/oauth";
import { getOAuthProviderDefinition } from "@/lib/oauth/providers";

export async function runOAuthConnectionRefreshCycle() {
  const connections = await listOauthConnectionsNeedingRefresh({
    limit: 5,
  });
  let processedCount = 0;

  for (const connection of connections) {
    const claimed = await claimOauthConnectionForRefresh({
      connectionId: connection.connectionId,
    });

    if (!claimed?.refreshToken) {
      continue;
    }

    const provider = getOAuthProviderDefinition(claimed.providerKey);

    if (!provider) {
      await recordOauthRefreshFailure({
        connectionId: claimed.connectionId,
        errorMessage: `Unsupported OAuth provider: ${claimed.providerKey}`,
        kind: "reauthorize",
        providerKey: claimed.providerKey,
        tenantIntegrationId: claimed.tenantIntegrationId,
      });
      processedCount += 1;
      continue;
    }

    try {
      const tokenResult = await provider.refreshAccessToken({
        refreshToken: claimed.refreshToken,
      });

      await applyOauthRefreshSuccess({
        connectionId: claimed.connectionId,
        providerKey: claimed.providerKey,
        requestedScopes: provider.getRequestedScopes(),
        tenantIntegrationId: claimed.tenantIntegrationId,
        tokenResult,
      });
    } catch (error) {
      await recordOauthRefreshFailure({
        connectionId: claimed.connectionId,
        errorMessage: getErrorMessage(error),
        kind: provider.classifyError(error),
        providerKey: claimed.providerKey,
        tenantIntegrationId: claimed.tenantIntegrationId,
      });
    }

    processedCount += 1;
  }

  return processedCount;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "OAuth token refresh failed.";
}

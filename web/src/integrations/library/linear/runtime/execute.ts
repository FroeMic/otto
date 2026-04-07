import type { IntegrationExecutionContext } from "@/integrations/framework/types";

import { searchLinearIssues } from "./search-issues";

export async function executeLinearSearchIssues(input: {
  context: IntegrationExecutionContext;
  params: Record<string, unknown>;
}) {
  if (!input.context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const result = await searchLinearIssues({
    accessToken: input.context.auth.accessToken,
    limit:
      typeof input.params.limit === "number" ? input.params.limit : undefined,
    query: typeof input.params.query === "string" ? input.params.query : "",
  });

  console.info(
    `[runtime-integrations] linear search tenantIntegration=${input.context.tenantIntegrationId ?? "missing"} operation=search_issues query=${JSON.stringify(result.query)} totalMatched=${result.totalMatched}`,
  );

  return result;
}

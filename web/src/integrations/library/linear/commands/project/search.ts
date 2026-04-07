import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearProjectCollectionCommandResult,
  executeLinearGraphql,
  getLinearProjectFields,
  type LinearProjectNode,
  normalizeLimit,
} from "../../client";

const SEARCH_PROJECTS_QUERY = `
  query OttoLinearProjectSearch($limit: Int!, $query: String!) {
    projects(
      first: $limit
      orderBy: updatedAt
      filter: {
        or: [
          { name: { containsIgnoreCase: $query } }
          { slugId: { containsIgnoreCase: $query } }
          { searchableContent: { contains: $query } }
        ]
      }
    ) {
      nodes {
        ${getLinearProjectFields()}
      }
    }
  }
`;

export const executeLinearProjectSearch: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const query = typeof args.query === "string" ? args.query.trim() : "";

  if (!query) {
    throw new Error("linear project.search requires query.");
  }

  const limit = normalizeLimit({
    defaultLimit: 10,
    max: 25,
    value: args.limit,
  });
  const data = await executeLinearGraphql<{
    projects?: {
      nodes?: LinearProjectNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: SEARCH_PROJECTS_QUERY,
    variables: {
      limit,
      query,
    },
  });

  return {
    ...buildLinearProjectCollectionCommandResult({
      commandKey: "project.search",
      items: data.projects?.nodes ?? [],
      limit,
    }),
    query,
  };
};

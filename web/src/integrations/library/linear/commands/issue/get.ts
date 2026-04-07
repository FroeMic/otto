import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  executeLinearGraphql,
  getLinearIssueFields,
  type LinearIssueNode,
  mapLinearIssue,
} from "../../client";

const GET_ISSUE_BY_SEARCH_QUERY = `
  query OttoLinearIssueGet($term: String!) {
    searchIssues(term: $term, first: 10) {
      nodes {
        ${getLinearIssueFields()}
      }
    }
  }
`;

export const executeLinearIssueGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const identifierOrId =
    typeof args.identifierOrId === "string" ? args.identifierOrId.trim() : "";

  if (!identifierOrId) {
    throw new Error("linear issue.get requires identifierOrId.");
  }

  const data = await executeLinearGraphql<{
    searchIssues?: {
      nodes?: LinearIssueNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: GET_ISSUE_BY_SEARCH_QUERY,
    variables: {
      term: identifierOrId,
    },
  });

  const normalizedLookup = identifierOrId.toLowerCase();
  const exactMatch =
    (data.searchIssues?.nodes ?? []).find((issue) => {
      const id = issue.id?.trim().toLowerCase();
      const identifier = issue.identifier?.trim().toLowerCase();

      return id === normalizedLookup || identifier === normalizedLookup;
    }) ?? (data.searchIssues?.nodes ?? [])[0];

  if (!exactMatch) {
    throw new Error(`Linear could not find issue ${identifierOrId}.`);
  }

  return {
    commandKey: "issue.get",
    integrationKey: "linear",
    issue: mapLinearIssue(exactMatch),
    lookup: identifierOrId,
    source: "linear",
  };
};

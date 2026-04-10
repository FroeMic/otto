import type { IntegrationCommandExecute } from "../../../../framework";

import { executeLinearGraphql, normalizeLimit } from "../../client";

const LIST_WORKFLOW_STATES_QUERY = `
  query OttoLinearListWorkflowStates($limit: Int!) {
    workflowStates(first: $limit) {
      nodes {
        id
        name
        type
        position
        team {
          id
          key
          name
        }
      }
    }
  }
`;

export const executeLinearWorkspaceListWorkflowStates: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const limit = normalizeLimit({
      defaultLimit: 50,
      max: 200,
      value: args.limit,
    });
    const data = await executeLinearGraphql<{
      workflowStates?: {
        nodes?: Array<{
          id: string;
          name?: string | null;
          position?: number | null;
          team?: {
            id?: string | null;
            key?: string | null;
            name?: string | null;
          } | null;
          type?: string | null;
        }> | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_WORKFLOW_STATES_QUERY,
      variables: {
        limit,
      },
    });

    return {
      commandKey: "workspace.list_workflow_states",
      integrationKey: "linear",
      items: (data.workflowStates?.nodes ?? []).map((state) => ({
        id: state.id,
        name: state.name?.trim() || "Unnamed state",
        position: typeof state.position === "number" ? state.position : null,
        team: state.team?.key?.trim() || state.team?.name?.trim() || null,
        teamId: state.team?.id?.trim() || null,
        type: state.type?.trim() || null,
      })),
      limit,
      source: "linear",
    };
  };

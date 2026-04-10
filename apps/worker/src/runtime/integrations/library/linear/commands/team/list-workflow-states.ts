import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearTeamChildCollectionCommandResult,
  executeLinearGraphql,
  findLinearTeamByIdOrKey,
  getLinearWorkflowStateFields,
  type LinearTeamNode,
  type LinearWorkflowStateNode,
  mapLinearWorkflowState,
  normalizeLimit,
  resolveLinearTeamId,
} from "../../client";

const LIST_TEAM_WORKFLOW_STATES_QUERY = `
  query OttoLinearTeamListWorkflowStates($id: String!, $limit: Int!) {
    team(id: $id) {
      id
      key
      name
      displayName
      description
      color
      icon
      private
      cyclesEnabled
      triageEnabled
      issueCount
      createdAt
      updatedAt
      archivedAt
      retiredAt
      activeCycle {
        id
        name
        number
        description
        startsAt
        endsAt
        createdAt
        completedAt
        progress
        isActive
        isFuture
        isPast
        team {
          id
          key
          name
        }
      }
      parent {
        id
        key
        name
        displayName
      }
      states(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearWorkflowStateFields()}
        }
      }
    }
  }
`;

export const executeLinearTeamListWorkflowStates: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const teamIdOrKey =
      typeof args.teamIdOrKey === "string" ? args.teamIdOrKey.trim() : "";

    if (!teamIdOrKey) {
      throw new Error("linear team.list_workflow_states requires teamIdOrKey.");
    }

    const teamId = await resolveLinearTeamId({
      accessToken: context.auth.accessToken,
      teamIdOrKey,
    });
    const limit = normalizeLimit({
      defaultLimit: 50,
      max: 200,
      value: args.limit,
    });
    const data = await executeLinearGraphql<{
      team?:
        | (LinearTeamNode & {
            states?: {
              nodes?: LinearWorkflowStateNode[] | null;
            } | null;
          })
        | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_TEAM_WORKFLOW_STATES_QUERY,
      variables: {
        id: teamId,
        limit,
      },
    });

    const team =
      data.team ??
      (await findLinearTeamByIdOrKey({
        accessToken: context.auth.accessToken,
        teamIdOrKey,
      }));

    if (!team) {
      throw new Error(`Linear could not find team ${teamIdOrKey}.`);
    }

    return {
      ...buildLinearTeamChildCollectionCommandResult({
        commandKey: "team.list_workflow_states",
        items: (data.team?.states?.nodes ?? []).map(mapLinearWorkflowState),
        limit,
        team,
      }),
      lookup: teamIdOrKey,
    };
  };

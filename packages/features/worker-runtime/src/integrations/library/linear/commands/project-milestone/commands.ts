import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearDeleteCommandResult,
  buildLinearProjectMilestoneCollectionCommandResult,
  buildLinearProjectMilestoneCommandResult,
  executeLinearGraphql,
  getLinearProjectMilestoneFields,
  type LinearProjectMilestoneNode,
  normalizeLimit,
} from "../../client";
import {
  buildLinearProjectMilestoneCreateInput,
  buildLinearProjectMilestoneMoveInput,
  buildLinearProjectMilestoneUpdateInput,
} from "./input";

const LIST_PROJECT_MILESTONES_QUERY = `
  query OttoLinearProjectMilestoneList($limit: Int!) {
    projectMilestones(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearProjectMilestoneFields()}
      }
    }
  }
`;

const GET_PROJECT_MILESTONE_QUERY = `
  query OttoLinearProjectMilestoneGet($id: String!) {
    projectMilestone(id: $id) {
      ${getLinearProjectMilestoneFields()}
    }
  }
`;

const CREATE_PROJECT_MILESTONE_MUTATION = `
  mutation OttoLinearProjectMilestoneCreate($input: ProjectMilestoneCreateInput!) {
    projectMilestoneCreate(input: $input) {
      lastSyncId
      projectMilestone {
        ${getLinearProjectMilestoneFields()}
      }
      success
    }
  }
`;

const UPDATE_PROJECT_MILESTONE_MUTATION = `
  mutation OttoLinearProjectMilestoneUpdate($id: String!, $input: ProjectMilestoneUpdateInput!) {
    projectMilestoneUpdate(id: $id, input: $input) {
      lastSyncId
      projectMilestone {
        ${getLinearProjectMilestoneFields()}
      }
      success
    }
  }
`;

const DELETE_PROJECT_MILESTONE_MUTATION = `
  mutation OttoLinearProjectMilestoneDelete($id: String!) {
    projectMilestoneDelete(id: $id) {
      entityId
      lastSyncId
      success
    }
  }
`;

const MOVE_PROJECT_MILESTONE_MUTATION = `
  mutation OttoLinearProjectMilestoneMove($id: String!, $input: ProjectMilestoneMoveInput!) {
    projectMilestoneMove(id: $id, input: $input) {
      lastSyncId
      previousIssueTeamIds {
        issueId
        teamId
      }
      previousProjectTeamIds {
        projectId
        teamIds
      }
      projectMilestone {
        ${getLinearProjectMilestoneFields()}
      }
      success
    }
  }
`;

export const executeLinearProjectMilestoneList: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    });
    const data = await executeLinearGraphql<{
      projectMilestones?: {
        nodes?: LinearProjectMilestoneNode[] | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_PROJECT_MILESTONES_QUERY,
      variables: {
        limit,
      },
    });

    return buildLinearProjectMilestoneCollectionCommandResult({
      commandKey: "project_milestone.list",
      items: data.projectMilestones?.nodes ?? [],
      limit,
    });
  };

export const executeLinearProjectMilestoneGet: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const milestoneId =
      typeof args.milestoneId === "string" ? args.milestoneId.trim() : "";

    if (!milestoneId) {
      throw new Error("linear project_milestone.get requires milestoneId.");
    }

    const data = await executeLinearGraphql<{
      projectMilestone?: LinearProjectMilestoneNode | null;
    }>({
      accessToken: context.auth.accessToken,
      query: GET_PROJECT_MILESTONE_QUERY,
      variables: {
        id: milestoneId,
      },
    });

    return {
      ...buildLinearProjectMilestoneCommandResult({
        commandKey: "project_milestone.get",
        milestone: data.projectMilestone,
      }),
      lookup: milestoneId,
    };
  };

export const executeLinearProjectMilestoneCreate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const input = buildLinearProjectMilestoneCreateInput(args);
    const data = await executeLinearGraphql<{
      projectMilestoneCreate?: {
        lastSyncId?: number | null;
        projectMilestone?: LinearProjectMilestoneNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_PROJECT_MILESTONE_MUTATION,
      variables: {
        input,
      },
    });

    return buildLinearProjectMilestoneCommandResult({
      commandKey: "project_milestone.create",
      lastSyncId: data.projectMilestoneCreate?.lastSyncId,
      milestone: data.projectMilestoneCreate?.projectMilestone,
      success: data.projectMilestoneCreate?.success,
    });
  };

export const executeLinearProjectMilestoneUpdate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const milestoneId =
      typeof args.milestoneId === "string" ? args.milestoneId.trim() : "";

    if (!milestoneId) {
      throw new Error("linear project_milestone.update requires milestoneId.");
    }

    const input = buildLinearProjectMilestoneUpdateInput(args);
    const data = await executeLinearGraphql<{
      projectMilestoneUpdate?: {
        lastSyncId?: number | null;
        projectMilestone?: LinearProjectMilestoneNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: UPDATE_PROJECT_MILESTONE_MUTATION,
      variables: {
        id: milestoneId,
        input,
      },
    });

    return buildLinearProjectMilestoneCommandResult({
      commandKey: "project_milestone.update",
      lastSyncId: data.projectMilestoneUpdate?.lastSyncId,
      milestone: data.projectMilestoneUpdate?.projectMilestone,
      success: data.projectMilestoneUpdate?.success,
    });
  };

export const executeLinearProjectMilestoneDelete: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const milestoneId =
      typeof args.milestoneId === "string" ? args.milestoneId.trim() : "";

    if (!milestoneId) {
      throw new Error("linear project_milestone.delete requires milestoneId.");
    }

    const data = await executeLinearGraphql<{
      projectMilestoneDelete?: {
        entityId?: string | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: DELETE_PROJECT_MILESTONE_MUTATION,
      variables: {
        id: milestoneId,
      },
    });

    return buildLinearDeleteCommandResult({
      commandKey: "project_milestone.delete",
      entityId: data.projectMilestoneDelete?.entityId,
      entityKey: "ProjectMilestoneId",
      lastSyncId: data.projectMilestoneDelete?.lastSyncId,
      success: data.projectMilestoneDelete?.success,
    });
  };

export const executeLinearProjectMilestoneMove: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const milestoneId =
      typeof args.milestoneId === "string" ? args.milestoneId.trim() : "";

    if (!milestoneId) {
      throw new Error("linear project_milestone.move requires milestoneId.");
    }

    const input = buildLinearProjectMilestoneMoveInput(args);
    const data = await executeLinearGraphql<{
      projectMilestoneMove?: {
        lastSyncId?: number | null;
        previousIssueTeamIds?: Array<{
          issueId?: string | null;
          teamId?: string | null;
        }> | null;
        previousProjectTeamIds?: {
          projectId?: string | null;
          teamIds?: string[] | null;
        } | null;
        projectMilestone?: LinearProjectMilestoneNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: MOVE_PROJECT_MILESTONE_MUTATION,
      variables: {
        id: milestoneId,
        input,
      },
    });

    return {
      ...buildLinearProjectMilestoneCommandResult({
        commandKey: "project_milestone.move",
        lastSyncId: data.projectMilestoneMove?.lastSyncId,
        milestone: data.projectMilestoneMove?.projectMilestone,
        success: data.projectMilestoneMove?.success,
      }),
      previousIssueTeamIds:
        data.projectMilestoneMove?.previousIssueTeamIds?.map((entry) => ({
          issueId: entry.issueId?.trim() || null,
          teamId: entry.teamId?.trim() || null,
        })) ?? [],
      previousProjectTeamIds: data.projectMilestoneMove?.previousProjectTeamIds
        ? {
            projectId:
              data.projectMilestoneMove.previousProjectTeamIds.projectId?.trim() ||
              null,
            teamIds:
              data.projectMilestoneMove.previousProjectTeamIds.teamIds?.map(
                (teamId) => teamId.trim(),
              ) ?? [],
          }
        : null,
    };
  };

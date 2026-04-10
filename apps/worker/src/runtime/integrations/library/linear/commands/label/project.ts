import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearDeleteCommandResult,
  buildLinearProjectLabelCollectionCommandResult,
  buildLinearProjectLabelCommandResult,
  executeLinearGraphql,
  getLinearProjectLabelFields,
  type LinearProjectLabelNode,
  normalizeLimit,
} from "../../client";
import {
  buildLinearProjectLabelCreateInput,
  buildLinearProjectLabelUpdateInput,
} from "./input";

const LIST_PROJECT_LABELS_QUERY = `
  query OttoLinearProjectLabelList($limit: Int!) {
    projectLabels(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearProjectLabelFields()}
      }
    }
  }
`;

const GET_PROJECT_LABEL_QUERY = `
  query OttoLinearProjectLabelGet($id: String!) {
    projectLabel(id: $id) {
      ${getLinearProjectLabelFields()}
    }
  }
`;

const CREATE_PROJECT_LABEL_MUTATION = `
  mutation OttoLinearProjectLabelCreate($input: ProjectLabelCreateInput!) {
    projectLabelCreate(input: $input) {
      projectLabel {
        ${getLinearProjectLabelFields()}
      }
      lastSyncId
      success
    }
  }
`;

const UPDATE_PROJECT_LABEL_MUTATION = `
  mutation OttoLinearProjectLabelUpdate($id: String!, $input: ProjectLabelUpdateInput!) {
    projectLabelUpdate(id: $id, input: $input) {
      projectLabel {
        ${getLinearProjectLabelFields()}
      }
      lastSyncId
      success
    }
  }
`;

const DELETE_PROJECT_LABEL_MUTATION = `
  mutation OttoLinearProjectLabelDelete($id: String!) {
    projectLabelDelete(id: $id) {
      entityId
      lastSyncId
      success
    }
  }
`;

const RESTORE_PROJECT_LABEL_MUTATION = `
  mutation OttoLinearProjectLabelRestore($id: String!) {
    projectLabelRestore(id: $id) {
      projectLabel {
        ${getLinearProjectLabelFields()}
      }
      lastSyncId
      success
    }
  }
`;

const RETIRE_PROJECT_LABEL_MUTATION = `
  mutation OttoLinearProjectLabelRetire($id: String!) {
    projectLabelRetire(id: $id) {
      projectLabel {
        ${getLinearProjectLabelFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearLabelListProjectLabels: IntegrationCommandExecute =
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
      projectLabels?: {
        nodes?: LinearProjectLabelNode[] | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_PROJECT_LABELS_QUERY,
      variables: {
        limit,
      },
    });

    return buildLinearProjectLabelCollectionCommandResult({
      commandKey: "label.list_project_labels",
      items: data.projectLabels?.nodes ?? [],
      limit,
    });
  };

export const executeLinearLabelGetProjectLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const labelId = typeof args.labelId === "string" ? args.labelId.trim() : "";

    if (!labelId) {
      throw new Error("linear label.get_project_label requires labelId.");
    }

    const data = await executeLinearGraphql<{
      projectLabel?: LinearProjectLabelNode | null;
    }>({
      accessToken: context.auth.accessToken,
      query: GET_PROJECT_LABEL_QUERY,
      variables: {
        id: labelId,
      },
    });

    return {
      ...buildLinearProjectLabelCommandResult({
        commandKey: "label.get_project_label",
        projectLabel: data.projectLabel,
      }),
      lookup: labelId,
    };
  };

export const executeLinearLabelCreateProjectLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const input = buildLinearProjectLabelCreateInput(args);
    const data = await executeLinearGraphql<{
      projectLabelCreate?: {
        lastSyncId?: number | null;
        projectLabel?: LinearProjectLabelNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_PROJECT_LABEL_MUTATION,
      variables: {
        input,
      },
    });

    return buildLinearProjectLabelCommandResult({
      commandKey: "label.create_project_label",
      lastSyncId: data.projectLabelCreate?.lastSyncId,
      projectLabel: data.projectLabelCreate?.projectLabel,
      success: data.projectLabelCreate?.success,
    });
  };

export const executeLinearLabelUpdateProjectLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const labelId = typeof args.labelId === "string" ? args.labelId.trim() : "";

    if (!labelId) {
      throw new Error("linear label.update_project_label requires labelId.");
    }

    const input = buildLinearProjectLabelUpdateInput(args);
    const data = await executeLinearGraphql<{
      projectLabelUpdate?: {
        lastSyncId?: number | null;
        projectLabel?: LinearProjectLabelNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: UPDATE_PROJECT_LABEL_MUTATION,
      variables: {
        id: labelId,
        input,
      },
    });

    return buildLinearProjectLabelCommandResult({
      commandKey: "label.update_project_label",
      lastSyncId: data.projectLabelUpdate?.lastSyncId,
      projectLabel: data.projectLabelUpdate?.projectLabel,
      success: data.projectLabelUpdate?.success,
    });
  };

export const executeLinearLabelDeleteProjectLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const labelId = typeof args.labelId === "string" ? args.labelId.trim() : "";

    if (!labelId) {
      throw new Error("linear label.delete_project_label requires labelId.");
    }

    const data = await executeLinearGraphql<{
      projectLabelDelete?: {
        entityId?: string | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: DELETE_PROJECT_LABEL_MUTATION,
      variables: {
        id: labelId,
      },
    });

    return buildLinearDeleteCommandResult({
      commandKey: "label.delete_project_label",
      entityId: data.projectLabelDelete?.entityId,
      entityKey: "ProjectLabelId",
      lastSyncId: data.projectLabelDelete?.lastSyncId,
      success: data.projectLabelDelete?.success,
    });
  };

export const executeLinearLabelRestoreProjectLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const labelId = typeof args.labelId === "string" ? args.labelId.trim() : "";

    if (!labelId) {
      throw new Error("linear label.restore_project_label requires labelId.");
    }

    const data = await executeLinearGraphql<{
      projectLabelRestore?: {
        lastSyncId?: number | null;
        projectLabel?: LinearProjectLabelNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: RESTORE_PROJECT_LABEL_MUTATION,
      variables: {
        id: labelId,
      },
    });

    return buildLinearProjectLabelCommandResult({
      commandKey: "label.restore_project_label",
      lastSyncId: data.projectLabelRestore?.lastSyncId,
      projectLabel: data.projectLabelRestore?.projectLabel,
      success: data.projectLabelRestore?.success,
    });
  };

export const executeLinearLabelRetireProjectLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const labelId = typeof args.labelId === "string" ? args.labelId.trim() : "";

    if (!labelId) {
      throw new Error("linear label.retire_project_label requires labelId.");
    }

    const data = await executeLinearGraphql<{
      projectLabelRetire?: {
        lastSyncId?: number | null;
        projectLabel?: LinearProjectLabelNode | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: RETIRE_PROJECT_LABEL_MUTATION,
      variables: {
        id: labelId,
      },
    });

    return buildLinearProjectLabelCommandResult({
      commandKey: "label.retire_project_label",
      lastSyncId: data.projectLabelRetire?.lastSyncId,
      projectLabel: data.projectLabelRetire?.projectLabel,
      success: data.projectLabelRetire?.success,
    });
  };

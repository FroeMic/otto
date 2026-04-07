import type { IntegrationCommandExecute } from "@/integrations/framework";

import {
  buildLinearDeleteCommandResult,
  buildLinearIssueLabelCollectionCommandResult,
  buildLinearIssueLabelCommandResult,
  executeLinearGraphql,
  getLinearIssueLabelFields,
  type LinearIssueLabelNode,
  normalizeLimit,
} from "../../client";
import {
  buildLinearIssueLabelCreateInput,
  buildLinearIssueLabelUpdateInput,
} from "./input";

const LIST_ISSUE_LABELS_QUERY = `
  query OttoLinearIssueLabelList($limit: Int!) {
    issueLabels(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearIssueLabelFields()}
      }
    }
  }
`;

const GET_ISSUE_LABEL_QUERY = `
  query OttoLinearIssueLabelGet($id: String!) {
    issueLabel(id: $id) {
      ${getLinearIssueLabelFields()}
    }
  }
`;

const CREATE_ISSUE_LABEL_MUTATION = `
  mutation OttoLinearIssueLabelCreate(
    $input: IssueLabelCreateInput!
    $replaceTeamLabels: Boolean
  ) {
    issueLabelCreate(input: $input, replaceTeamLabels: $replaceTeamLabels) {
      issueLabel {
        ${getLinearIssueLabelFields()}
      }
      lastSyncId
      success
    }
  }
`;

const UPDATE_ISSUE_LABEL_MUTATION = `
  mutation OttoLinearIssueLabelUpdate(
    $id: String!
    $input: IssueLabelUpdateInput!
    $replaceTeamLabels: Boolean
  ) {
    issueLabelUpdate(
      id: $id
      input: $input
      replaceTeamLabels: $replaceTeamLabels
    ) {
      issueLabel {
        ${getLinearIssueLabelFields()}
      }
      lastSyncId
      success
    }
  }
`;

const DELETE_ISSUE_LABEL_MUTATION = `
  mutation OttoLinearIssueLabelDelete($id: String!) {
    issueLabelDelete(id: $id) {
      entityId
      lastSyncId
      success
    }
  }
`;

const RESTORE_ISSUE_LABEL_MUTATION = `
  mutation OttoLinearIssueLabelRestore($id: String!) {
    issueLabelRestore(id: $id) {
      issueLabel {
        ${getLinearIssueLabelFields()}
      }
      lastSyncId
      success
    }
  }
`;

const RETIRE_ISSUE_LABEL_MUTATION = `
  mutation OttoLinearIssueLabelRetire($id: String!) {
    issueLabelRetire(id: $id) {
      issueLabel {
        ${getLinearIssueLabelFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearLabelListIssueLabels: IntegrationCommandExecute =
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
      issueLabels?: {
        nodes?: LinearIssueLabelNode[] | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_ISSUE_LABELS_QUERY,
      variables: {
        limit,
      },
    });

    return buildLinearIssueLabelCollectionCommandResult({
      commandKey: "label.list_issue_labels",
      items: data.issueLabels?.nodes ?? [],
      limit,
    });
  };

export const executeLinearLabelGetIssueLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const labelId = typeof args.labelId === "string" ? args.labelId.trim() : "";

    if (!labelId) {
      throw new Error("linear label.get_issue_label requires labelId.");
    }

    const data = await executeLinearGraphql<{
      issueLabel?: LinearIssueLabelNode | null;
    }>({
      accessToken: context.auth.accessToken,
      query: GET_ISSUE_LABEL_QUERY,
      variables: {
        id: labelId,
      },
    });

    return {
      ...buildLinearIssueLabelCommandResult({
        commandKey: "label.get_issue_label",
        issueLabel: data.issueLabel,
      }),
      lookup: labelId,
    };
  };

export const executeLinearLabelCreateIssueLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const input = buildLinearIssueLabelCreateInput(args);
    const replaceTeamLabels =
      typeof args.replaceTeamLabels === "boolean" ? args.replaceTeamLabels : null;
    const data = await executeLinearGraphql<{
      issueLabelCreate?: {
        issueLabel?: LinearIssueLabelNode | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_ISSUE_LABEL_MUTATION,
      variables: {
        input,
        replaceTeamLabels,
      },
    });

    return buildLinearIssueLabelCommandResult({
      commandKey: "label.create_issue_label",
      issueLabel: data.issueLabelCreate?.issueLabel,
      lastSyncId: data.issueLabelCreate?.lastSyncId,
      success: data.issueLabelCreate?.success,
    });
  };

export const executeLinearLabelUpdateIssueLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const labelId = typeof args.labelId === "string" ? args.labelId.trim() : "";

    if (!labelId) {
      throw new Error("linear label.update_issue_label requires labelId.");
    }

    const input = buildLinearIssueLabelUpdateInput(args);
    const replaceTeamLabels =
      typeof args.replaceTeamLabels === "boolean" ? args.replaceTeamLabels : null;
    const data = await executeLinearGraphql<{
      issueLabelUpdate?: {
        issueLabel?: LinearIssueLabelNode | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: UPDATE_ISSUE_LABEL_MUTATION,
      variables: {
        id: labelId,
        input,
        replaceTeamLabels,
      },
    });

    return buildLinearIssueLabelCommandResult({
      commandKey: "label.update_issue_label",
      issueLabel: data.issueLabelUpdate?.issueLabel,
      lastSyncId: data.issueLabelUpdate?.lastSyncId,
      success: data.issueLabelUpdate?.success,
    });
  };

export const executeLinearLabelDeleteIssueLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const labelId = typeof args.labelId === "string" ? args.labelId.trim() : "";

    if (!labelId) {
      throw new Error("linear label.delete_issue_label requires labelId.");
    }

    const data = await executeLinearGraphql<{
      issueLabelDelete?: {
        entityId?: string | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: DELETE_ISSUE_LABEL_MUTATION,
      variables: {
        id: labelId,
      },
    });

    return buildLinearDeleteCommandResult({
      commandKey: "label.delete_issue_label",
      entityId: data.issueLabelDelete?.entityId,
      entityKey: "IssueLabelId",
      lastSyncId: data.issueLabelDelete?.lastSyncId,
      success: data.issueLabelDelete?.success,
    });
  };

export const executeLinearLabelRestoreIssueLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const labelId = typeof args.labelId === "string" ? args.labelId.trim() : "";

    if (!labelId) {
      throw new Error("linear label.restore_issue_label requires labelId.");
    }

    const data = await executeLinearGraphql<{
      issueLabelRestore?: {
        issueLabel?: LinearIssueLabelNode | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: RESTORE_ISSUE_LABEL_MUTATION,
      variables: {
        id: labelId,
      },
    });

    return buildLinearIssueLabelCommandResult({
      commandKey: "label.restore_issue_label",
      issueLabel: data.issueLabelRestore?.issueLabel,
      lastSyncId: data.issueLabelRestore?.lastSyncId,
      success: data.issueLabelRestore?.success,
    });
  };

export const executeLinearLabelRetireIssueLabel: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const labelId = typeof args.labelId === "string" ? args.labelId.trim() : "";

    if (!labelId) {
      throw new Error("linear label.retire_issue_label requires labelId.");
    }

    const data = await executeLinearGraphql<{
      issueLabelRetire?: {
        issueLabel?: LinearIssueLabelNode | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: RETIRE_ISSUE_LABEL_MUTATION,
      variables: {
        id: labelId,
      },
    });

    return buildLinearIssueLabelCommandResult({
      commandKey: "label.retire_issue_label",
      issueLabel: data.issueLabelRetire?.issueLabel,
      lastSyncId: data.issueLabelRetire?.lastSyncId,
      success: data.issueLabelRetire?.success,
    });
  };

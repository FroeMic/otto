import type { IntegrationCommandExecute } from "../../../../framework";

import {
  buildLinearDeleteCommandResult,
  buildLinearInitiativeCollectionCommandResult,
  buildLinearInitiativeCommandResult,
  buildLinearInitiativeUpdateCollectionCommandResult,
  buildLinearInitiativeUpdateCommandResult,
  buildLinearProjectCollectionCommandResult,
  executeLinearGraphql,
  getLinearInitiativeFields,
  getLinearInitiativeUpdateFields,
  getLinearProjectFields,
  type LinearInitiativeNode,
  type LinearInitiativeUpdateNode,
  type LinearProjectNode,
  normalizeLimit,
} from "../../client";
import {
  buildLinearInitiativeCreateInput,
  buildLinearInitiativeUpdateInput,
} from "./input";

const LIST_INITIATIVES_QUERY = `
  query OttoLinearInitiativeList($limit: Int!) {
    initiatives(first: $limit, orderBy: updatedAt) {
      nodes {
        ${getLinearInitiativeFields()}
      }
    }
  }
`;

const GET_INITIATIVE_QUERY = `
  query OttoLinearInitiativeGet($id: String!) {
    initiative(id: $id) {
      ${getLinearInitiativeFields()}
    }
  }
`;

const CREATE_INITIATIVE_MUTATION = `
  mutation OttoLinearInitiativeCreate($input: InitiativeCreateInput!) {
    initiativeCreate(input: $input) {
      initiative {
        ${getLinearInitiativeFields()}
      }
      lastSyncId
      success
    }
  }
`;

const UPDATE_INITIATIVE_MUTATION = `
  mutation OttoLinearInitiativeUpdate($id: String!, $input: InitiativeUpdateInput!) {
    initiativeUpdate(id: $id, input: $input) {
      initiative {
        ${getLinearInitiativeFields()}
      }
      lastSyncId
      success
    }
  }
`;

const ARCHIVE_INITIATIVE_MUTATION = `
  mutation OttoLinearInitiativeArchive($id: String!) {
    initiativeArchive(id: $id) {
      entity {
        ${getLinearInitiativeFields()}
      }
      lastSyncId
      success
    }
  }
`;

const DELETE_INITIATIVE_MUTATION = `
  mutation OttoLinearInitiativeDelete($id: String!) {
    initiativeDelete(id: $id) {
      entityId
      lastSyncId
      success
    }
  }
`;

const LIST_INITIATIVE_PROJECTS_QUERY = `
  query OttoLinearInitiativeListProjects($id: String!, $limit: Int!) {
    initiative(id: $id) {
      ${getLinearInitiativeFields()}
      projects(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearProjectFields()}
        }
      }
    }
  }
`;

const LIST_INITIATIVE_UPDATES_QUERY = `
  query OttoLinearInitiativeListUpdates($id: String!, $limit: Int!) {
    initiative(id: $id) {
      ${getLinearInitiativeFields()}
      initiativeUpdates(first: $limit, orderBy: updatedAt) {
        nodes {
          ${getLinearInitiativeUpdateFields()}
        }
      }
    }
  }
`;

const CREATE_INITIATIVE_UPDATE_MUTATION = `
  mutation OttoLinearInitiativeUpdateCreate($input: InitiativeUpdateCreateInput!) {
    initiativeUpdateCreate(input: $input) {
      initiativeUpdate {
        ${getLinearInitiativeUpdateFields()}
      }
      lastSyncId
      success
    }
  }
`;

export const executeLinearInitiativeList: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const limit = normalizeLimit({
    defaultLimit: 25,
    max: 100,
    value: args.limit,
  });
  const data = await executeLinearGraphql<{
    initiatives?: {
      nodes?: LinearInitiativeNode[] | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: LIST_INITIATIVES_QUERY,
    variables: { limit },
  });

  return buildLinearInitiativeCollectionCommandResult({
    commandKey: "initiative.list",
    items: data.initiatives?.nodes ?? [],
    limit,
  });
};

export const executeLinearInitiativeGet: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const initiativeId =
    typeof args.initiativeId === "string" ? args.initiativeId.trim() : "";

  if (!initiativeId) {
    throw new Error("linear initiative.get requires initiativeId.");
  }

  const data = await executeLinearGraphql<{
    initiative?: LinearInitiativeNode | null;
  }>({
    accessToken: context.auth.accessToken,
    query: GET_INITIATIVE_QUERY,
    variables: { id: initiativeId },
  });

  return {
    ...buildLinearInitiativeCommandResult({
      commandKey: "initiative.get",
      initiative: data.initiative,
    }),
    lookup: initiativeId,
  };
};

export const executeLinearInitiativeCreate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const input = buildLinearInitiativeCreateInput(args);
  const data = await executeLinearGraphql<{
    initiativeCreate?: {
      initiative?: LinearInitiativeNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: CREATE_INITIATIVE_MUTATION,
    variables: { input },
  });

  return buildLinearInitiativeCommandResult({
    commandKey: "initiative.create",
    initiative: data.initiativeCreate?.initiative,
    lastSyncId: data.initiativeCreate?.lastSyncId,
    success: data.initiativeCreate?.success,
  });
};

export const executeLinearInitiativeUpdate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const initiativeId =
    typeof args.initiativeId === "string" ? args.initiativeId.trim() : "";

  if (!initiativeId) {
    throw new Error("linear initiative.update requires initiativeId.");
  }

  const input = buildLinearInitiativeUpdateInput(args);
  const data = await executeLinearGraphql<{
    initiativeUpdate?: {
      initiative?: LinearInitiativeNode | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: UPDATE_INITIATIVE_MUTATION,
    variables: { id: initiativeId, input },
  });

  return buildLinearInitiativeCommandResult({
    commandKey: "initiative.update",
    initiative: data.initiativeUpdate?.initiative,
    lastSyncId: data.initiativeUpdate?.lastSyncId,
    success: data.initiativeUpdate?.success,
  });
};

export const executeLinearInitiativeArchive: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const initiativeId =
      typeof args.initiativeId === "string" ? args.initiativeId.trim() : "";

    if (!initiativeId) {
      throw new Error("linear initiative.archive requires initiativeId.");
    }

    const data = await executeLinearGraphql<{
      initiativeArchive?: {
        entity?: LinearInitiativeNode | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: ARCHIVE_INITIATIVE_MUTATION,
      variables: { id: initiativeId },
    });

    return buildLinearInitiativeCommandResult({
      commandKey: "initiative.archive",
      initiative: data.initiativeArchive?.entity,
      lastSyncId: data.initiativeArchive?.lastSyncId,
      success: data.initiativeArchive?.success,
    });
  };

export const executeLinearInitiativeDelete: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.");
  }

  const initiativeId =
    typeof args.initiativeId === "string" ? args.initiativeId.trim() : "";

  if (!initiativeId) {
    throw new Error("linear initiative.delete requires initiativeId.");
  }

  const data = await executeLinearGraphql<{
    initiativeDelete?: {
      entityId?: string | null;
      lastSyncId?: number | null;
      success?: boolean | null;
    } | null;
  }>({
    accessToken: context.auth.accessToken,
    query: DELETE_INITIATIVE_MUTATION,
    variables: { id: initiativeId },
  });

  return {
    ...buildLinearDeleteCommandResult({
      commandKey: "initiative.delete",
      entityId: data.initiativeDelete?.entityId,
      entityKey: "InitiativeId",
      lastSyncId: data.initiativeDelete?.lastSyncId,
      success: data.initiativeDelete?.success,
    }),
    lookup: initiativeId,
  };
};

export const executeLinearInitiativeListProjects: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const initiativeId =
      typeof args.initiativeId === "string" ? args.initiativeId.trim() : "";

    if (!initiativeId) {
      throw new Error("linear initiative.list_projects requires initiativeId.");
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    });
    const data = await executeLinearGraphql<{
      initiative?:
        | (LinearInitiativeNode & {
            projects?: {
              nodes?: LinearProjectNode[] | null;
            } | null;
          })
        | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_INITIATIVE_PROJECTS_QUERY,
      variables: { id: initiativeId, limit },
    });

    if (!data.initiative) {
      throw new Error(
        "Linear returned no initiative for initiative.list_projects.",
      );
    }

    return {
      ...buildLinearProjectCollectionCommandResult({
        commandKey: "initiative.list_projects",
        items: data.initiative.projects?.nodes ?? [],
        limit,
      }),
      initiative: buildLinearInitiativeCommandResult({
        commandKey: "initiative.list_projects",
        initiative: data.initiative,
      }).initiative,
      lookup: initiativeId,
    };
  };

export const executeLinearInitiativeListUpdates: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const initiativeId =
      typeof args.initiativeId === "string" ? args.initiativeId.trim() : "";

    if (!initiativeId) {
      throw new Error("linear initiative.list_updates requires initiativeId.");
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    });
    const data = await executeLinearGraphql<{
      initiative?:
        | (LinearInitiativeNode & {
            initiativeUpdates?: {
              nodes?: LinearInitiativeUpdateNode[] | null;
            } | null;
          })
        | null;
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_INITIATIVE_UPDATES_QUERY,
      variables: { id: initiativeId, limit },
    });

    if (!data.initiative) {
      throw new Error(
        "Linear returned no initiative for initiative.list_updates.",
      );
    }

    return {
      ...buildLinearInitiativeUpdateCollectionCommandResult({
        commandKey: "initiative.list_updates",
        initiative: data.initiative,
        items: data.initiative.initiativeUpdates?.nodes ?? [],
        limit,
      }),
      lookup: initiativeId,
    };
  };

export const executeLinearInitiativeCreateUpdate: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.");
    }

    const initiativeId =
      typeof args.initiativeId === "string" ? args.initiativeId.trim() : "";

    if (!initiativeId) {
      throw new Error("linear initiative.create_update requires initiativeId.");
    }

    const input: {
      body?: string;
      health?: string;
      initiativeId: string;
      isDiffHidden?: boolean;
    } = {
      initiativeId,
    };

    if (typeof args.body === "string" && args.body.trim()) {
      input.body = args.body;
    }

    if (typeof args.health === "string" && args.health.trim()) {
      input.health = args.health.trim();
    }

    if (typeof args.isDiffHidden === "boolean") {
      input.isDiffHidden = args.isDiffHidden;
    }

    const data = await executeLinearGraphql<{
      initiativeUpdateCreate?: {
        initiativeUpdate?: LinearInitiativeUpdateNode | null;
        lastSyncId?: number | null;
        success?: boolean | null;
      } | null;
    }>({
      accessToken: context.auth.accessToken,
      query: CREATE_INITIATIVE_UPDATE_MUTATION,
      variables: { input },
    });

    return {
      ...buildLinearInitiativeUpdateCommandResult({
        commandKey: "initiative.create_update",
        initiativeUpdate: data.initiativeUpdateCreate?.initiativeUpdate,
        lastSyncId: data.initiativeUpdateCreate?.lastSyncId,
        success: data.initiativeUpdateCreate?.success,
      }),
      lookup: initiativeId,
    };
  };

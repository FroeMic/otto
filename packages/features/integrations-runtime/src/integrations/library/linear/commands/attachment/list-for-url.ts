import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearAttachmentCollectionCommandResult,
  executeLinearGraphql,
  getLinearAttachmentFields,
  type LinearAttachmentNode,
  normalizeLimit,
} from "../../client"

const LIST_ATTACHMENTS_FOR_URL_QUERY = `
  query OttoLinearAttachmentListForUrl($limit: Int!, $url: String!) {
    attachmentsForURL(first: $limit, orderBy: updatedAt, url: $url) {
      nodes {
        ${getLinearAttachmentFields()}
      }
    }
  }
`

export const executeLinearAttachmentListForUrl: IntegrationCommandExecute =
  async ({ arguments: args, context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const url = typeof args.url === "string" ? args.url.trim() : ""

    if (!url) {
      throw new Error("linear attachment.list_for_url requires url.")
    }

    const limit = normalizeLimit({
      defaultLimit: 25,
      max: 100,
      value: args.limit,
    })

    const data = await executeLinearGraphql<{
      attachmentsForURL?: {
        nodes?: LinearAttachmentNode[] | null
      } | null
    }>({
      accessToken: context.auth.accessToken,
      query: LIST_ATTACHMENTS_FOR_URL_QUERY,
      variables: {
        limit,
        url,
      },
    })

    return {
      ...buildLinearAttachmentCollectionCommandResult({
        commandKey: "attachment.list_for_url",
        items: data.attachmentsForURL?.nodes ?? [],
        limit,
      }),
      lookup: url,
    }
  }

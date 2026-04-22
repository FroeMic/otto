import type { IntegrationCommandExecute } from "../../../../framework"

import { executeLinearGraphql } from "../../client"

const GET_VIEWER_QUERY = `
  query OttoLinearGetViewer {
    viewer {
      id
      name
      email
      admin
      active
      createdAt
      url
    }
  }
`

export const executeLinearWorkspaceGetViewer: IntegrationCommandExecute =
  async ({ context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const data = await executeLinearGraphql<{
      viewer: {
        active?: boolean | null
        admin?: boolean | null
        createdAt?: string | null
        email?: string | null
        id: string
        name?: string | null
        url?: string | null
      }
    }>({
      accessToken: context.auth.accessToken,
      query: GET_VIEWER_QUERY,
    })

    return {
      commandKey: "workspace.get_viewer",
      integrationKey: "linear",
      source: "linear",
      viewer: {
        active: Boolean(data.viewer.active),
        admin: Boolean(data.viewer.admin),
        createdAt: data.viewer.createdAt ?? null,
        email: data.viewer.email?.trim() || null,
        id: data.viewer.id,
        name: data.viewer.name?.trim() || "Unknown user",
        url: data.viewer.url ?? null,
      },
    }
  }

import type { IntegrationCommandExecute } from "../../../../framework"

import { executeLinearGraphql } from "../../client"

const GET_ORGANIZATION_QUERY = `
  query OttoLinearGetOrganization {
    organization {
      id
      name
      urlKey
      logoUrl
      createdAt
      roadmapEnabled
      periodUploadVolume
      createdIssueCount
      customerCount
      projectStatuses {
        id
      }
    }
  }
`

export const executeLinearWorkspaceGetOrganization: IntegrationCommandExecute =
  async ({ context }) => {
    if (!context.auth) {
      throw new Error("Linear requires an authenticated execution context.")
    }

    const data = await executeLinearGraphql<{
      organization: {
        createdAt?: string | null
        createdIssueCount?: number | null
        customerCount?: number | null
        id: string
        logoUrl?: string | null
        name?: string | null
        periodUploadVolume?: number | null
        projectStatuses?: Array<{
          id?: string | null
        }> | null
        roadmapEnabled?: boolean | null
        urlKey?: string | null
      }
    }>({
      accessToken: context.auth.accessToken,
      query: GET_ORGANIZATION_QUERY,
    })

    return {
      commandKey: "workspace.get_organization",
      integrationKey: "linear",
      organization: {
        createdAt: data.organization.createdAt ?? null,
        createdIssueCount:
          typeof data.organization.createdIssueCount === "number"
            ? data.organization.createdIssueCount
            : null,
        customerCount:
          typeof data.organization.customerCount === "number"
            ? data.organization.customerCount
            : null,
        id: data.organization.id,
        logoUrl: data.organization.logoUrl ?? null,
        name: data.organization.name?.trim() || "Unnamed organization",
        periodUploadVolume:
          typeof data.organization.periodUploadVolume === "number"
            ? data.organization.periodUploadVolume
            : null,
        projectStatusCount: Array.isArray(data.organization.projectStatuses)
          ? data.organization.projectStatuses.length
          : 0,
        roadmapEnabled: Boolean(data.organization.roadmapEnabled),
        urlKey: data.organization.urlKey?.trim() || null,
      },
      source: "linear",
    }
  }

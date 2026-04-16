import type { IntegrationCommandExecute } from "../../../../framework"

import {
  buildLinearCycleCommandResult,
  executeLinearGraphql,
  getLinearCycleFields,
  type LinearCycleNode,
} from "../../client"
import { buildLinearCycleUpdateInput } from "./input"

const UPDATE_CYCLE_MUTATION = `
  mutation OttoLinearCycleUpdate($id: String!, $input: CycleUpdateInput!) {
    cycleUpdate(id: $id, input: $input) {
      cycle {
        ${getLinearCycleFields()}
      }
      lastSyncId
      success
    }
  }
`

export const executeLinearCycleUpdate: IntegrationCommandExecute = async ({
  arguments: args,
  context,
}) => {
  if (!context.auth) {
    throw new Error("Linear requires an authenticated execution context.")
  }

  const cycleId = typeof args.cycleId === "string" ? args.cycleId.trim() : ""

  if (!cycleId) {
    throw new Error("linear cycle.update requires cycleId.")
  }

  const input = buildLinearCycleUpdateInput(args)
  const data = await executeLinearGraphql<{
    cycleUpdate?: {
      cycle?: LinearCycleNode | null
      lastSyncId?: number | null
      success?: boolean | null
    } | null
  }>({
    accessToken: context.auth.accessToken,
    query: UPDATE_CYCLE_MUTATION,
    variables: {
      id: cycleId,
      input,
    },
  })

  return {
    ...buildLinearCycleCommandResult({
      commandKey: "cycle.update",
      cycle: data.cycleUpdate?.cycle,
      lastSyncId: data.cycleUpdate?.lastSyncId,
      success: data.cycleUpdate?.success,
    }),
    lookup: cycleId,
  }
}

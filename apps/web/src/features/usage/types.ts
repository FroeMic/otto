import {
  usageOverviewSchema,
  usageSearchSchema,
} from "@otto/feature-workspace-core"
import { z } from "zod"

export type UsageOverview = z.infer<typeof usageOverviewSchema>
export type UsageSearch = z.infer<typeof usageSearchSchema>

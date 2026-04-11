import { BraveIntegrationOverviewItem } from "./library/brave/overview-item"
import { BraveIntegrationStatusPage } from "./library/brave/pages/BraveIntegrationStatusPage"
import { LinearIntegrationOverviewItem } from "./library/linear/overview-item"
import { LinearIntegrationStatusPage } from "./library/linear/pages/LinearIntegrationStatusPage"
import { SlackIntegrationOverviewItem } from "./library/slack/overview-item"
import { SlackIntegrationStatusPage } from "./library/slack/pages/SlackIntegrationStatusPage"

export const integrationOverviewRegistry = {
  brave: BraveIntegrationOverviewItem,
  linear: LinearIntegrationOverviewItem,
  slack: SlackIntegrationOverviewItem,
} as const

export const integrationDetailRegistry = {
  brave: BraveIntegrationStatusPage,
  linear: LinearIntegrationStatusPage,
  slack: SlackIntegrationStatusPage,
} as const

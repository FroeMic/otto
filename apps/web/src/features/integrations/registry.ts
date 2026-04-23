import { BraveIntegrationOverviewItem } from "./library/brave/overview-item"
import { BraveIntegrationStatusPage } from "./library/brave/pages/BraveIntegrationStatusPage"
import { GandiIntegrationOverviewItem } from "./library/gandi/overview-item"
import { GandiIntegrationStatusPage } from "./library/gandi/pages/GandiIntegrationStatusPage"
import { GitHubIntegrationOverviewItem } from "./library/github/overview-item"
import { GitHubIntegrationStatusPage } from "./library/github/pages/GitHubIntegrationStatusPage"
import { LinearIntegrationOverviewItem } from "./library/linear/overview-item"
import { LinearIntegrationStatusPage } from "./library/linear/pages/LinearIntegrationStatusPage"
import { PostHogIntegrationOverviewItem } from "./library/posthog/overview-item"
import { PostHogIntegrationStatusPage } from "./library/posthog/pages/PostHogIntegrationStatusPage"
import { SlackIntegrationOverviewItem } from "./library/slack/overview-item"
import { SlackIntegrationStatusPage } from "./library/slack/pages/SlackIntegrationStatusPage"

export const integrationOverviewRegistry = {
  brave: BraveIntegrationOverviewItem,
  gandi: GandiIntegrationOverviewItem,
  github: GitHubIntegrationOverviewItem,
  linear: LinearIntegrationOverviewItem,
  posthog: PostHogIntegrationOverviewItem,
  slack: SlackIntegrationOverviewItem,
} as const

export const integrationDetailRegistry = {
  brave: BraveIntegrationStatusPage,
  gandi: GandiIntegrationStatusPage,
  github: GitHubIntegrationStatusPage,
  linear: LinearIntegrationStatusPage,
  posthog: PostHogIntegrationStatusPage,
  slack: SlackIntegrationStatusPage,
} as const

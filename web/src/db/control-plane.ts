import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type {
  Invitation,
  OrganizationMembership,
  User,
} from "@workos-inc/node";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  integrationSecrets,
  jobEvents,
  jobRuns,
  memberships,
  messagingConversations,
  messagingWorkspaceMembers,
  messagingWorkspaces,
  organizations,
  slackInstallations,
  tenantApplyRuns,
  tenantDesiredStates,
  tenantIntegrations,
  tenantManagedConfigVersions,
  tenantManagedFileVersions,
  tenantOnboardingSessions,
  tenantRuntimeConfigEntries,
  tenantRuntimeConfigMutations,
  tenantRuntimeSecrets,
  tenantServers,
  tenants,
  userPlatformRoles,
  users,
  whatsappInstallations,
  whatsappLinkSessions,
} from "@/db/schema";
import {
  decryptControlPlaneSecret,
  encryptControlPlaneSecret,
} from "@/lib/crypto";
import { getControlPlaneBaseUrl, getEnv } from "@/lib/env";
import { enqueueJob } from "@/lib/jobs/queue";
import { JOB_TYPES } from "@/lib/jobs/types";
import {
  buildManagedBootstrapFileContent,
  buildManagedBootstrapSystemContent,
  getManagedBootstrapFileDefinitions,
  isManagedBootstrapFilePath,
  type ManagedBootstrapFilePath,
} from "@/lib/openclaw/managed-config";
import {
  fetchSlackMessagingDirectory,
  joinSlackChannel,
  leaveSlackChannel,
} from "@/lib/slack";
import {
  getDefaultSlackRuntimeConfig,
  parseSlackRuntimeConfig,
  SLACK_RUNTIME_CONFIG_DESCRIPTION,
  SLACK_RUNTIME_CONFIG_LABEL,
  SLACK_RUNTIME_CONFIG_SCHEMA_SOURCE,
  SLACK_RUNTIME_CONFIG_SCHEMA_VERSION,
  SLACK_RUNTIME_CONFIG_SURFACE_KEY,
  SLACK_RUNTIME_CONFIG_SURFACE_KIND,
  type SlackRuntimeConfig,
  slackRuntimeConfigJsonSchema,
  slackRuntimeConfigPatchSchema,
  slackRuntimeConfigUiHints,
} from "@/lib/slack-config";
import {
  resolveRuntimeWebSearchConfig,
  WEB_SEARCH_TOOL_DESCRIPTION,
  WEB_SEARCH_TOOL_LABEL,
  WEB_SEARCH_TOOL_SCHEMA_VERSION,
  WEB_SEARCH_TOOL_SURFACE_KEY,
  WEB_SEARCH_TOOL_SURFACE_KIND,
  webSearchRuntimeConfigJsonSchema,
  webSearchRuntimeConfigUiHints,
} from "@/lib/web-search-config";
import {
  getDefaultWhatsAppRuntimeConfig,
  parseWhatsAppRuntimeConfig,
  WHATSAPP_RUNTIME_CONFIG_DESCRIPTION,
  WHATSAPP_RUNTIME_CONFIG_LABEL,
  WHATSAPP_RUNTIME_CONFIG_SCHEMA_SOURCE,
  WHATSAPP_RUNTIME_CONFIG_SCHEMA_VERSION,
  WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY,
  WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND,
  type WhatsAppRuntimeConfig,
  whatsappRuntimeConfigJsonSchema,
  whatsappRuntimeConfigUiHints,
} from "@/lib/whatsapp-config";
import { getWorkOS } from "@/lib/workos";
import {
  getToolDefinition,
  getToolSurfaceId,
  listAvailableToolActions,
  listToolDefinitions,
  normalizeInstallState,
} from "@/tools";
import { evaluateSlackPolicyForTenant } from "@/tools/server";
import {
  applySlackPolicyAction,
  isSlackPolicyDestructive,
  type SlackPolicyAction,
  type SlackPolicyDerivedEffects,
} from "@/tools/slack/policy";
import type {
  ToolInstallState,
  ToolSurfaceAction,
  ToolSurfaceResponse,
} from "@/tools/types";
import {
  deriveWhatsAppPolicyEffects,
  type WhatsAppPolicyDerivedEffects,
} from "@/tools/whatsapp/policy";

const SLACK_PROVIDER_KEY = "slack";
const WHATSAPP_PROVIDER_KEY = "whatsapp";
const SLACK_BOT_TOKEN_SECRET_TYPE = "slack_bot_token";
const OPENCLAW_GATEWAY_TOKEN_SECRET_TYPE = "openclaw_gateway_token";
const PLATFORM_ADMIN_ROLE = "PLATFORM_ADMIN";

function isSlackSurface(surfaceKind: string, surfaceKey: string) {
  return (
    surfaceKind === SLACK_RUNTIME_CONFIG_SURFACE_KIND &&
    surfaceKey === SLACK_RUNTIME_CONFIG_SURFACE_KEY
  );
}

function isWhatsAppSurface(surfaceKind: string, surfaceKey: string) {
  return (
    surfaceKind === WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND &&
    surfaceKey === WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY
  );
}

function getSurfaceConfigMutationError(definition: {
  label: string;
  surfaceType: "global" | "integration" | "tool";
  supportsConfig: boolean;
}) {
  if (definition.supportsConfig) {
    return null;
  }

  return definition.surfaceType === "global"
    ? `${definition.label} is managed by Otto and cannot be edited from the UI or runtime.`
    : `${definition.label} does not support direct config edits.`;
}

function getSurfaceLifecycleMutationError(definition: {
  label: string;
  surfaceType: "global" | "integration" | "tool";
  supportsEnable: boolean;
  supportsInstall: boolean;
}) {
  if (definition.supportsEnable || definition.supportsInstall) {
    return null;
  }

  return definition.surfaceType === "global"
    ? `${definition.label} is managed by Otto and cannot be enabled, disabled, installed, or uninstalled from the UI or runtime.`
    : `${definition.label} does not support install or enable lifecycle changes.`;
}

function getSurfaceReapplyError(definition: {
  label: string;
  surfaceType: "global" | "integration" | "tool";
  supportsReapply: boolean;
}) {
  if (definition.supportsReapply) {
    return null;
  }

  return definition.surfaceType === "global"
    ? `${definition.label} is managed by Otto and does not support manual reapply.`
    : `${definition.label} does not support manual reapply.`;
}

type OnboardingSessionSummary = {
  createdAt: Date;
  id: string;
  slackConnectedAt: Date | null;
  slackOauthError: string | null;
  slackOauthErrorAt: Date | null;
  slackTeamName: string | null;
  status: string;
  tenantName: string;
};

type SlackIntegrationSummary = {
  connectedAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  status: string;
  teamName: string | null;
};

type WhatsAppIntegrationSummary = {
  connectedAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  selfE164: string | null;
  status: string;
};

type TenantApplyRunSummary = {
  desiredStateVersion: number;
  error: string | null;
  finishedAt: Date | null;
  startedAt: Date | null;
  status: string;
};

export type TenantManagedConfigFile = {
  checksum: string;
  description: string;
  label: string;
  path: ManagedBootstrapFilePath;
  renderedContent: string;
  sharedContent: string;
  systemContent: string;
};

export type TenantManagedConfig = {
  createdAt: Date;
  createdByExternalId: string | null;
  createdByType: string;
  files: TenantManagedConfigFile[];
  summary: string | null;
  version: number;
};

type MessagingDirectoryMemberInput = {
  avatarUrl: string | null;
  displayName: string | null;
  email: string | null;
  externalMemberId: string;
  fullName: string | null;
  isDeleted: boolean;
  memberType: string;
  profileJson: unknown;
  username: string | null;
};

type MessagingConversationInput = {
  conversationType: string;
  externalConversationId: string;
  isArchived: boolean;
  metadataJson: unknown;
  name: string | null;
  purpose: string | null;
  topic: string | null;
};

export type TenantSlackRuntimeConfig = {
  ackReactionEnabled: boolean;
  allowedChannelIds: string[];
  allowedUserIds: string[];
  answerInThreads: boolean;
  channelAccessMode: "manual_allowlist" | "member_of_channels";
  enabled: boolean;
  entryVersion: number;
  installState: ToolInstallState;
  requireMentionInChannels: boolean;
  schemaVersion: string;
};

export type TenantWhatsAppRuntimeConfig = {
  ackReactionEnabled: boolean;
  allowedGroupIds: string[];
  allowedNumbers: string[];
  dmPolicy: "pairing" | "allowlist" | "disabled";
  enabled: boolean;
  entryVersion: number;
  groupAllowedNumbers: string[];
  groupPolicy: "disabled" | "allowlist";
  installState: ToolInstallState;
  requireMentionInGroups: boolean;
  schemaVersion: string;
};

export type SlackRuntimeConfigDirectoryOption = {
  memberCount?: number | null;
  description: string | null;
  id: string;
  isArchived?: boolean;
  isMember?: boolean;
  label: string;
  secondaryLabel: string | null;
  visibility?: "private" | "public" | null;
};

export type TenantSlackRuntimeConfigSurface = {
  agentOperations?: Array<{
    description: string;
    key: string;
    label: string;
  }>;
  availableChannels: SlackRuntimeConfigDirectoryOption[];
  availableUsers: SlackRuntimeConfigDirectoryOption[];
  availability?: "available" | "blocked";
  blockingReason?: string | null;
  canAgentEdit?: boolean;
  canUserEdit?: boolean;
  config: TenantSlackRuntimeConfig;
  description: string;
  derivedEffects?: SlackPolicyDerivedEffects;
  fieldMeanings: Array<{
    description: string;
    key: string;
    label: string;
  }>;
  key: string;
  kind: string;
  label: string;
  actionMeanings: Array<{
    action: ToolSurfaceAction;
    description: string;
    label: string;
  }>;
  allowedActions: ToolSurfaceAction[];
  id: string;
  schema: typeof slackRuntimeConfigJsonSchema;
  settingsUrl?: string | null;
  setupUrl?: string | null;
  surfaceType: "integration";
  uiGroup: "integrations";
  uiHints: typeof slackRuntimeConfigUiHints;
};

export type TenantWhatsAppRuntimeConfigSurface = {
  agentOperations?: Array<{
    description: string;
    key: string;
    label: string;
  }>;
  availability?: "available" | "blocked";
  blockingReason?: string | null;
  canAgentEdit?: boolean;
  canUserEdit?: boolean;
  config: TenantWhatsAppRuntimeConfig;
  description: string;
  derivedEffects?: WhatsAppPolicyDerivedEffects;
  fieldMeanings: Array<{
    description: string;
    key: string;
    label: string;
  }>;
  key: string;
  kind: string;
  label: string;
  actionMeanings: Array<{
    action: ToolSurfaceAction;
    description: string;
    label: string;
  }>;
  allowedActions: ToolSurfaceAction[];
  id: string;
  schema: typeof whatsappRuntimeConfigJsonSchema;
  settingsUrl?: string | null;
  setupUrl?: string | null;
  surfaceType: "integration";
  uiGroup: "integrations";
  uiHints: typeof whatsappRuntimeConfigUiHints;
};

export type TenantWhatsAppLinkSession = {
  completedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
  forceRelink: boolean;
  id: string;
  lastError: string | null;
  qrDataUrl: string | null;
  status: string;
  updatedAt: Date;
};

export type TenantToolConfigSurface = ToolSurfaceResponse<
  Record<string, unknown>,
  Record<string, unknown>
>;

export class ManagedConfigVersionConflictError extends Error {
  constructor(
    readonly expectedVersion: number,
    readonly currentVersion: number,
  ) {
    super(
      `Managed config version mismatch: expected ${expectedVersion}, current ${currentVersion}`,
    );
  }
}

export class TenantRuntimeConfigVersionConflictError extends Error {
  constructor(
    readonly expectedVersion: number,
    readonly currentVersion: number,
  ) {
    super(
      `Runtime config version mismatch: expected ${expectedVersion}, current ${currentVersion}`,
    );
  }
}

type DbTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export type DashboardOrganization = {
  id: string;
  externalId: string;
  isReady: boolean;
  latestOnboardingSession: OnboardingSessionSummary | null;
  onboardingDraft: OnboardingSessionSummary | null;
  name: string;
  role: string;
  slackIntegration: SlackIntegrationSummary | null;
  whatsappIntegration: WhatsAppIntegrationSummary | null;
  slug: string;
  tenants: Array<{
    createdAt: Date;
    id: string;
    ipv4: string | null;
    latestJob: {
      attempt: number;
      error: string | null;
      events: Array<{
        createdAt: Date;
        eventType: string;
        message: string;
      }>;
      finishedAt: Date | null;
      id: string;
      startedAt: Date | null;
      status: string;
      step: string | null;
    } | null;
    name: string;
    latestApplyRun: {
      desiredStateVersion: number;
      error: string | null;
      finishedAt: Date | null;
      startedAt: Date | null;
      status: string;
    } | null;
    status: string;
    serverStatus: string | null;
  }>;
};

export type PlatformOrganization = {
  id: string;
  isReady: boolean;
  name: string;
  runtimeImage: string;
  runtimeImageVersion: string | null;
  slackIntegration: SlackIntegrationSummary | null;
  slug: string;
  tenant: {
    id: string;
    ipv4: string | null;
    latestApplyRun: {
      desiredStateVersion: number;
      error: string | null;
      finishedAt: Date | null;
      startedAt: Date | null;
      status: string;
    } | null;
    latestJob: {
      attempt: number;
      error: string | null;
      events: Array<{
        createdAt: Date;
        eventType: string;
        message: string;
      }>;
      finishedAt: Date | null;
      id: string;
      startedAt: Date | null;
      status: string;
      step: string | null;
    } | null;
    name: string;
    serverStatus: string | null;
    status: string;
  } | null;
};

export type PlatformTenantTarget = {
  ipv4: string | null;
  organizationId: string;
  orgSlug: string;
  serverStatus: string | null;
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
};

export type WorkspaceMemberDirectoryEntry = {
  avatarUrl: string | null;
  email: string;
  id: string;
  joinedAt: Date | null;
  lastSeenAt: Date | null;
  name: string;
  role: string | null;
  rowType: "invitation" | "member";
  searchText: string;
  status: string;
  subtitle: string | null;
};

export type WorkspaceMemberDirectory = {
  activeMemberCount: number;
  canManageMembers: boolean;
  entries: WorkspaceMemberDirectoryEntry[];
  invitationCount: number;
  organizationName: string;
  organizationSlug: string;
};

export async function syncUserFromSession(user: User) {
  const syncedUser = await upsertLocalUser(user);

  await backfillOrganizationsFromWorkOS(user.id, syncedUser.id);

  return syncedUser;
}

async function upsertLocalUser(user: Pick<User, "email" | "id">) {
  const db = getDb();

  const [upsertedUser] = await db
    .insert(users)
    .values({
      externalId: user.id,
      email: user.email,
    })
    .onConflictDoUpdate({
      target: users.externalId,
      set: {
        email: user.email,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: users.id,
      externalId: users.externalId,
      email: users.email,
    });

  return upsertedUser;
}

export async function hasPlatformAdminRole(userExternalId: string) {
  const db = getDb();
  const [role] = await db
    .select({
      role: userPlatformRoles.role,
    })
    .from(userPlatformRoles)
    .innerJoin(users, eq(userPlatformRoles.userId, users.id))
    .where(
      and(
        eq(users.externalId, userExternalId),
        eq(userPlatformRoles.role, PLATFORM_ADMIN_ROLE),
      ),
    )
    .limit(1);

  return Boolean(role);
}

async function requirePlatformAdmin(userExternalId: string) {
  const isPlatformAdmin = await hasPlatformAdminRole(userExternalId);

  if (!isPlatformAdmin) {
    throw new Error("Platform admin access required");
  }
}

export async function getDashboardOrganizations(
  userExternalId: string,
): Promise<DashboardOrganization[]> {
  const db = getDb();

  let organizationRows = await getDashboardOrganizationRows(userExternalId);

  if (organizationRows.length === 0) {
    await backfillOrganizationsFromWorkOS(userExternalId);
    organizationRows = await getDashboardOrganizationRows(userExternalId);
  }

  if (organizationRows.length === 0) {
    return [];
  }

  const organizationIds = organizationRows.map((row) => row.organizationId);

  const onboardingRows = await db
    .select({
      createdAt: tenantOnboardingSessions.createdAt,
      id: tenantOnboardingSessions.id,
      organizationId: tenantOnboardingSessions.organizationId,
      slackOauthError: tenantOnboardingSessions.slackOauthError,
      slackOauthErrorAt: tenantOnboardingSessions.slackOauthErrorAt,
      slackTeamName: tenantOnboardingSessions.slackTeamName,
      slackConnectedAt: tenantOnboardingSessions.slackConnectedAt,
      status: tenantOnboardingSessions.status,
      tenantId: tenantOnboardingSessions.tenantId,
      tenantName: tenantOnboardingSessions.tenantName,
      userId: tenantOnboardingSessions.userId,
    })
    .from(tenantOnboardingSessions)
    .innerJoin(users, eq(tenantOnboardingSessions.userId, users.id))
    .where(
      and(
        inArray(tenantOnboardingSessions.organizationId, organizationIds),
        eq(users.externalId, userExternalId),
      ),
    )
    .orderBy(desc(tenantOnboardingSessions.createdAt));

  const onboardingByOrganization = new Map<
    string,
    (typeof onboardingRows)[number]
  >();
  const latestOnboardingByOrganization = new Map<
    string,
    (typeof onboardingRows)[number]
  >();

  for (const onboarding of onboardingRows) {
    if (!latestOnboardingByOrganization.has(onboarding.organizationId)) {
      latestOnboardingByOrganization.set(onboarding.organizationId, onboarding);
    }

    if (onboarding.status === "completed") {
      continue;
    }

    if (!onboardingByOrganization.has(onboarding.organizationId)) {
      onboardingByOrganization.set(onboarding.organizationId, onboarding);
    }
  }

  const tenantRows = await db
    .select({
      createdAt: tenants.createdAt,
      id: tenants.id,
      ipv4: tenantServers.ipv4,
      organizationId: tenants.organizationId,
      name: tenants.name,
      status: tenants.status,
      serverStatus: tenantServers.status,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(inArray(tenants.organizationId, organizationIds))
    .orderBy(desc(tenants.createdAt));

  const tenantIds = tenantRows.map((tenant) => tenant.id);
  const slackIntegrationRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            connectedAt: tenantIntegrations.connectedAt,
            lastError: tenantIntegrations.lastError,
            lastErrorAt: tenantIntegrations.lastErrorAt,
            status: tenantIntegrations.status,
            teamName: slackInstallations.slackTeamName,
            tenantId: tenantIntegrations.tenantId,
          })
          .from(tenantIntegrations)
          .leftJoin(
            slackInstallations,
            eq(slackInstallations.tenantIntegrationId, tenantIntegrations.id),
          )
          .where(
            and(
              inArray(tenantIntegrations.tenantId, tenantIds),
              eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
            ),
          );
  const whatsappIntegrationRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            connectedAt: tenantIntegrations.connectedAt,
            lastError: tenantIntegrations.lastError,
            lastErrorAt: tenantIntegrations.lastErrorAt,
            selfE164: whatsappInstallations.selfE164,
            status: tenantIntegrations.status,
            tenantId: tenantIntegrations.tenantId,
          })
          .from(tenantIntegrations)
          .leftJoin(
            whatsappInstallations,
            eq(
              whatsappInstallations.tenantIntegrationId,
              tenantIntegrations.id,
            ),
          )
          .where(
            and(
              inArray(tenantIntegrations.tenantId, tenantIds),
              eq(tenantIntegrations.providerKey, WHATSAPP_PROVIDER_KEY),
            ),
          );

  const slackIntegrationsByTenant = new Map<
    string,
    (typeof slackIntegrationRows)[number]
  >();
  const whatsappIntegrationsByTenant = new Map<
    string,
    (typeof whatsappIntegrationRows)[number]
  >();

  for (const integration of slackIntegrationRows) {
    if (slackIntegrationsByTenant.has(integration.tenantId)) {
      continue;
    }

    slackIntegrationsByTenant.set(integration.tenantId, integration);
  }

  for (const integration of whatsappIntegrationRows) {
    if (whatsappIntegrationsByTenant.has(integration.tenantId)) {
      continue;
    }

    whatsappIntegrationsByTenant.set(integration.tenantId, integration);
  }

  const latestJobRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            attempt: jobRuns.attempt,
            createdAt: jobRuns.createdAt,
            error: jobRuns.error,
            finishedAt: jobRuns.finishedAt,
            id: jobRuns.id,
            payloadJson: jobRuns.payloadJson,
            startedAt: jobRuns.startedAt,
            status: jobRuns.status,
            tenantId: jobRuns.tenantId,
          })
          .from(jobRuns)
          .where(inArray(jobRuns.tenantId, tenantIds))
          .orderBy(desc(jobRuns.createdAt));

  const latestJobsByTenant = new Map<string, (typeof latestJobRows)[number]>();

  for (const job of latestJobRows) {
    if (!job.tenantId || latestJobsByTenant.has(job.tenantId)) {
      continue;
    }

    latestJobsByTenant.set(job.tenantId, job);
  }

  const latestJobIds = Array.from(latestJobsByTenant.values()).map(
    (job) => job.id,
  );

  const jobEventRows =
    latestJobIds.length === 0
      ? []
      : await db
          .select({
            createdAt: jobEvents.createdAt,
            eventType: jobEvents.eventType,
            jobRunId: jobEvents.jobRunId,
            message: jobEvents.message,
          })
          .from(jobEvents)
          .where(inArray(jobEvents.jobRunId, latestJobIds))
          .orderBy(desc(jobEvents.createdAt));

  const jobEventsByJobRunId = new Map<
    string,
    Array<{
      createdAt: Date;
      eventType: string;
      message: string;
    }>
  >();

  for (const event of jobEventRows) {
    const existingEvents = jobEventsByJobRunId.get(event.jobRunId) ?? [];
    existingEvents.push({
      createdAt: event.createdAt,
      eventType: event.eventType,
      message: event.message,
    });
    jobEventsByJobRunId.set(event.jobRunId, existingEvents);
  }

  const latestApplyRunRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            desiredStateVersion: tenantApplyRuns.desiredStateVersion,
            error: tenantApplyRuns.error,
            finishedAt: tenantApplyRuns.finishedAt,
            startedAt: tenantApplyRuns.startedAt,
            status: tenantApplyRuns.status,
            tenantId: tenantApplyRuns.tenantId,
          })
          .from(tenantApplyRuns)
          .where(inArray(tenantApplyRuns.tenantId, tenantIds))
          .orderBy(desc(tenantApplyRuns.createdAt));

  const latestApplyRunsByTenant = new Map<
    string,
    (typeof latestApplyRunRows)[number]
  >();

  for (const applyRun of latestApplyRunRows) {
    if (latestApplyRunsByTenant.has(applyRun.tenantId)) {
      continue;
    }

    latestApplyRunsByTenant.set(applyRun.tenantId, applyRun);
  }

  return organizationRows.map((organization) => {
    const organizationTenants = tenantRows
      .filter((tenant) => tenant.organizationId === organization.organizationId)
      .map((tenant) => ({
        createdAt: tenant.createdAt,
        id: tenant.id,
        ipv4: tenant.ipv4,
        latestApplyRun: buildTenantApplyRunSummary(
          latestApplyRunsByTenant.get(tenant.id) ?? null,
        ),
        latestJob: buildLatestJobSummary(
          latestJobsByTenant.get(tenant.id) ?? null,
          jobEventsByJobRunId,
        ),
        name: tenant.name,
        status: tenant.status,
        serverStatus: tenant.serverStatus,
      }));
    const primaryTenant = organizationTenants[0] ?? null;

    return {
      id: organization.organizationId,
      externalId: organization.organizationExternalId,
      isReady: organization.organizationIsReady,
      latestOnboardingSession: buildOnboardingDraftSummary(
        latestOnboardingByOrganization.get(organization.organizationId) ?? null,
      ),
      onboardingDraft: buildOnboardingDraftSummary(
        onboardingByOrganization.get(organization.organizationId) ?? null,
      ),
      name: organization.organizationName,
      role: organization.role,
      slackIntegration: buildSlackIntegrationSummary(
        primaryTenant
          ? (slackIntegrationsByTenant.get(primaryTenant.id) ?? null)
          : null,
      ),
      whatsappIntegration: buildWhatsAppIntegrationSummary(
        primaryTenant
          ? (whatsappIntegrationsByTenant.get(primaryTenant.id) ?? null)
          : null,
      ),
      slug: organization.organizationSlug,
      tenants: organizationTenants,
    };
  });
}

export async function listPlatformOrganizations(input: {
  userExternalId: string;
}): Promise<PlatformOrganization[]> {
  await requirePlatformAdmin(input.userExternalId);

  const db = getDb();
  const organizationRows = await db
    .select({
      id: organizations.id,
      isReady: organizations.isReady,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .orderBy(asc(organizations.name), asc(organizations.slug));

  if (organizationRows.length === 0) {
    return [];
  }

  const runtimeImage = getEnv().RUNTIME_OPENCLAW_IMAGE;
  const runtimeImageVersion = extractRuntimeImageVersion(runtimeImage);
  const organizationIds = organizationRows.map(
    (organization) => organization.id,
  );

  const tenantRows = await db
    .select({
      createdAt: tenants.createdAt,
      id: tenants.id,
      ipv4: tenantServers.ipv4,
      organizationId: tenants.organizationId,
      name: tenants.name,
      serverStatus: tenantServers.status,
      status: tenants.status,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(inArray(tenants.organizationId, organizationIds))
    .orderBy(desc(tenants.createdAt));

  const latestTenantsByOrganization = new Map<
    string,
    (typeof tenantRows)[number]
  >();

  for (const tenant of tenantRows) {
    if (!latestTenantsByOrganization.has(tenant.organizationId)) {
      latestTenantsByOrganization.set(tenant.organizationId, tenant);
    }
  }

  const tenantIds = Array.from(latestTenantsByOrganization.values()).map(
    (tenant) => tenant.id,
  );

  const slackIntegrationRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            connectedAt: tenantIntegrations.connectedAt,
            lastError: tenantIntegrations.lastError,
            lastErrorAt: tenantIntegrations.lastErrorAt,
            status: tenantIntegrations.status,
            teamName: slackInstallations.slackTeamName,
            tenantId: tenantIntegrations.tenantId,
          })
          .from(tenantIntegrations)
          .leftJoin(
            slackInstallations,
            eq(slackInstallations.tenantIntegrationId, tenantIntegrations.id),
          )
          .where(
            and(
              inArray(tenantIntegrations.tenantId, tenantIds),
              eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
            ),
          );

  const slackIntegrationsByTenant = new Map<
    string,
    (typeof slackIntegrationRows)[number]
  >();

  for (const integration of slackIntegrationRows) {
    if (!slackIntegrationsByTenant.has(integration.tenantId)) {
      slackIntegrationsByTenant.set(integration.tenantId, integration);
    }
  }

  const latestApplyRunRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            desiredStateVersion: tenantApplyRuns.desiredStateVersion,
            error: tenantApplyRuns.error,
            finishedAt: tenantApplyRuns.finishedAt,
            startedAt: tenantApplyRuns.startedAt,
            status: tenantApplyRuns.status,
            tenantId: tenantApplyRuns.tenantId,
          })
          .from(tenantApplyRuns)
          .where(inArray(tenantApplyRuns.tenantId, tenantIds))
          .orderBy(desc(tenantApplyRuns.createdAt));

  const latestApplyRunsByTenant = new Map<
    string,
    (typeof latestApplyRunRows)[number]
  >();

  for (const applyRun of latestApplyRunRows) {
    if (!latestApplyRunsByTenant.has(applyRun.tenantId)) {
      latestApplyRunsByTenant.set(applyRun.tenantId, applyRun);
    }
  }

  const latestJobRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            attempt: jobRuns.attempt,
            createdAt: jobRuns.createdAt,
            error: jobRuns.error,
            finishedAt: jobRuns.finishedAt,
            id: jobRuns.id,
            payloadJson: jobRuns.payloadJson,
            startedAt: jobRuns.startedAt,
            status: jobRuns.status,
            tenantId: jobRuns.tenantId,
          })
          .from(jobRuns)
          .where(inArray(jobRuns.tenantId, tenantIds))
          .orderBy(desc(jobRuns.createdAt));

  const latestJobsByTenant = new Map<string, (typeof latestJobRows)[number]>();

  for (const job of latestJobRows) {
    if (job.tenantId && !latestJobsByTenant.has(job.tenantId)) {
      latestJobsByTenant.set(job.tenantId, job);
    }
  }

  const latestJobIds = Array.from(latestJobsByTenant.values()).map(
    (job) => job.id,
  );

  const jobEventRows =
    latestJobIds.length === 0
      ? []
      : await db
          .select({
            createdAt: jobEvents.createdAt,
            eventType: jobEvents.eventType,
            jobRunId: jobEvents.jobRunId,
            message: jobEvents.message,
          })
          .from(jobEvents)
          .where(inArray(jobEvents.jobRunId, latestJobIds))
          .orderBy(desc(jobEvents.createdAt));

  const jobEventsByJobRunId = new Map<
    string,
    Array<{
      createdAt: Date;
      eventType: string;
      message: string;
    }>
  >();

  for (const event of jobEventRows) {
    const existingEvents = jobEventsByJobRunId.get(event.jobRunId) ?? [];
    existingEvents.push({
      createdAt: event.createdAt,
      eventType: event.eventType,
      message: event.message,
    });
    jobEventsByJobRunId.set(event.jobRunId, existingEvents);
  }

  return organizationRows.map((organization) => {
    const tenant = latestTenantsByOrganization.get(organization.id) ?? null;

    return {
      id: organization.id,
      isReady: organization.isReady,
      name: organization.name,
      runtimeImage,
      runtimeImageVersion,
      slackIntegration: tenant
        ? buildSlackIntegrationSummary(
            slackIntegrationsByTenant.get(tenant.id) ?? null,
          )
        : null,
      slug: organization.slug,
      tenant: tenant
        ? {
            id: tenant.id,
            ipv4: tenant.ipv4,
            latestApplyRun: buildTenantApplyRunSummary(
              latestApplyRunsByTenant.get(tenant.id) ?? null,
            ),
            latestJob: buildLatestJobSummary(
              latestJobsByTenant.get(tenant.id) ?? null,
              jobEventsByJobRunId,
            ),
            name: tenant.name,
            serverStatus: tenant.serverStatus,
            status: tenant.status,
          }
        : null,
    };
  });
}

async function getDashboardOrganizationRows(userExternalId: string) {
  const db = getDb();

  return db
    .select({
      organizationId: organizations.id,
      organizationExternalId: organizations.externalId,
      organizationIsReady: organizations.isReady,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(users.externalId, userExternalId));
}

type AuthorizedWorkspaceMembershipContext = {
  localRole: string;
  organizationExternalId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
};

async function getAuthorizedWorkspaceMembershipContext(input: {
  orgSlug: string;
  userExternalId: string;
}): Promise<AuthorizedWorkspaceMembershipContext> {
  const db = getDb();
  const [authorizedMembership] = await db
    .select({
      localRole: memberships.role,
      organizationExternalId: organizations.externalId,
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(
      and(
        eq(organizations.slug, input.orgSlug),
        eq(users.externalId, input.userExternalId),
      ),
    )
    .limit(1);

  if (!authorizedMembership) {
    throw new Error("You do not have access to this organization");
  }

  const workos = getWorkOS();
  const currentMemberships = await (
    await workos.userManagement.listOrganizationMemberships({
      organizationId: authorizedMembership.organizationExternalId,
      userId: input.userExternalId,
    })
  ).autoPagination();
  const activeMembership = currentMemberships.find(
    (membership) => membership.status === "active",
  );

  if (!activeMembership) {
    throw new Error("You do not have access to this organization");
  }

  if (
    activeMembership.organizationName &&
    activeMembership.organizationName !== authorizedMembership.organizationName
  ) {
    await db
      .update(organizations)
      .set({
        name: activeMembership.organizationName,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, authorizedMembership.organizationId));

    return {
      ...authorizedMembership,
      organizationName: activeMembership.organizationName,
    };
  }

  return authorizedMembership;
}

function canManageWorkspaceMembers(role: string) {
  return role === "admin" || role === "owner";
}

function parseWorkOsTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value);

  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function buildWorkspaceMemberSearchText(input: {
  email: string;
  name: string;
  role: string | null;
  status: string;
  subtitle: string | null;
}) {
  return [input.name, input.email, input.subtitle, input.role, input.status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildWorkspaceMemberEntry(input: {
  membership: OrganizationMembership;
  user: User | null;
}): WorkspaceMemberDirectoryEntry {
  const fullName = [input.user?.firstName, input.user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const email =
    input.user?.email ??
    `${input.membership.userId.slice(0, 8)}@workos-user.invalid`;
  const name = fullName || email;
  const subtitle =
    input.user?.email && fullName
      ? input.user.email.split("@")[0] || null
      : input.membership.directoryManaged
        ? "Directory-managed member"
        : null;

  return {
    avatarUrl: input.user?.profilePictureUrl ?? null,
    email,
    id: input.membership.id,
    joinedAt: parseWorkOsTimestamp(input.membership.createdAt),
    lastSeenAt: parseWorkOsTimestamp(input.user?.lastSignInAt),
    name,
    role: input.membership.role.slug,
    rowType: "member",
    searchText: buildWorkspaceMemberSearchText({
      email,
      name,
      role: input.membership.role.slug,
      status: input.membership.status,
      subtitle,
    }),
    status: input.membership.status,
    subtitle,
  };
}

function buildWorkspaceInvitationEntry(
  invitation: Invitation,
): WorkspaceMemberDirectoryEntry {
  const subtitle =
    invitation.state === "pending"
      ? "Invitation pending"
      : invitation.state === "expired"
        ? "Invitation expired"
        : "Invitation revoked";

  return {
    avatarUrl: null,
    email: invitation.email,
    id: invitation.id,
    joinedAt: parseWorkOsTimestamp(invitation.createdAt),
    lastSeenAt: null,
    name: invitation.email,
    role: null,
    rowType: "invitation",
    searchText: buildWorkspaceMemberSearchText({
      email: invitation.email,
      name: invitation.email,
      role: null,
      status: invitation.state,
      subtitle,
    }),
    status: invitation.state,
    subtitle,
  };
}

function getWorkspaceMemberSortOrder(entry: WorkspaceMemberDirectoryEntry) {
  if (entry.rowType === "member" && entry.status === "active") {
    return 0;
  }

  if (entry.rowType === "member") {
    return 1;
  }

  if (entry.status === "pending") {
    return 2;
  }

  return 3;
}

async function backfillOrganizationsFromWorkOS(
  userExternalId: string,
  localUserId?: string,
) {
  const db = getDb();
  const workos = getWorkOS();
  const workosUser = await workos.userManagement.getUser(userExternalId);
  const localUser =
    localUserId !== undefined
      ? { id: localUserId }
      : await upsertLocalUser(workosUser);
  const workosMemberships = await (
    await workos.userManagement.listOrganizationMemberships({
      userId: userExternalId,
    })
  ).autoPagination();
  const activeMemberships = workosMemberships.filter(
    (membership) => membership.status === "active",
  );

  if (activeMemberships.length === 0) {
    return;
  }

  const externalOrganizationIds = activeMemberships.map(
    (membership) => membership.organizationId,
  );
  const existingOrganizations = await db
    .select({
      externalId: organizations.externalId,
      id: organizations.id,
      name: organizations.name,
    })
    .from(organizations)
    .where(inArray(organizations.externalId, externalOrganizationIds));
  const organizationsByExternalId = new Map(
    existingOrganizations.map((organization) => [
      organization.externalId,
      organization,
    ]),
  );
  const existingMembershipRows = await db
    .select({
      organizationId: memberships.organizationId,
    })
    .from(memberships)
    .where(eq(memberships.userId, localUser.id));
  const existingMembershipOrgIds = new Set(
    existingMembershipRows.map((membership) => membership.organizationId),
  );

  for (const membership of activeMemberships) {
    let localOrganization = organizationsByExternalId.get(
      membership.organizationId,
    );

    if (!localOrganization) {
      const slug = await generateOrganizationSlugFromWorkOS(
        membership.organizationName,
        membership.organizationId,
      );
      const [createdOrganization] = await db
        .insert(organizations)
        .values({
          externalId: membership.organizationId,
          isReady: false,
          name: membership.organizationName,
          slug,
        })
        .returning({
          externalId: organizations.externalId,
          id: organizations.id,
          name: organizations.name,
        });

      localOrganization = createdOrganization;
      organizationsByExternalId.set(
        createdOrganization.externalId,
        createdOrganization,
      );
    } else if (localOrganization.name !== membership.organizationName) {
      await db
        .update(organizations)
        .set({
          name: membership.organizationName,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, localOrganization.id));
    }

    if (existingMembershipOrgIds.has(localOrganization.id)) {
      continue;
    }

    await db.insert(memberships).values({
      organizationId: localOrganization.id,
      role: membership.role.slug,
      userId: localUser.id,
    });
    existingMembershipOrgIds.add(localOrganization.id);
  }
}

function buildOnboardingDraftSummary(
  onboarding: OnboardingSessionSummary | null,
) {
  if (!onboarding) {
    return null;
  }

  return {
    createdAt: onboarding.createdAt,
    id: onboarding.id,
    slackOauthError: onboarding.slackOauthError,
    slackOauthErrorAt: onboarding.slackOauthErrorAt,
    slackTeamName: onboarding.slackTeamName,
    slackConnectedAt: onboarding.slackConnectedAt,
    status: onboarding.status,
    tenantName: onboarding.tenantName,
  };
}

function buildSlackIntegrationSummary(
  integration: SlackIntegrationSummary | null,
) {
  if (!integration) {
    return null;
  }

  return {
    connectedAt: integration.connectedAt,
    lastError: integration.lastError,
    lastErrorAt: integration.lastErrorAt,
    status: integration.status,
    teamName: integration.teamName,
  };
}

function buildWhatsAppIntegrationSummary(
  integration: WhatsAppIntegrationSummary | null,
) {
  if (!integration) {
    return null;
  }

  return {
    connectedAt: integration.connectedAt,
    lastError: integration.lastError,
    lastErrorAt: integration.lastErrorAt,
    selfE164: integration.selfE164,
    status: integration.status,
  };
}

function buildTenantApplyRunSummary(applyRun: TenantApplyRunSummary | null) {
  if (!applyRun) {
    return null;
  }

  return {
    desiredStateVersion: applyRun.desiredStateVersion,
    error: applyRun.error,
    finishedAt: applyRun.finishedAt,
    startedAt: applyRun.startedAt,
    status: applyRun.status,
  };
}

function buildLatestJobSummary(
  job: {
    attempt: number;
    error: string | null;
    finishedAt: Date | null;
    id: string;
    payloadJson: unknown;
    startedAt: Date | null;
    status: string;
  } | null,
  jobEventsByJobRunId: Map<
    string,
    Array<{
      createdAt: Date;
      eventType: string;
      message: string;
    }>
  >,
) {
  if (!job) {
    return null;
  }

  const payload = parseRecord(job.payloadJson);
  const step = typeof payload.step === "string" ? payload.step : null;
  const events = (jobEventsByJobRunId.get(job.id) ?? []).slice(0, 6).reverse();

  return {
    attempt: job.attempt,
    error: job.error,
    events,
    finishedAt: job.finishedAt,
    id: job.id,
    startedAt: job.startedAt,
    status: job.status,
    step,
  };
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export async function createWorkspaceOnboardingDraft(input: {
  workspaceName: string;
  workspaceSlug: string;
  user: User;
}) {
  const workos = getWorkOS();
  const db = getDb();
  const syncedUser = await syncUserFromSession(input.user);
  const normalizedSlug = normalizeOrganizationSlug(input.workspaceSlug);

  if (!normalizedSlug) {
    throw new Error("Workspace slug is required");
  }

  const [existingOrganization] = await db
    .select({
      id: organizations.id,
    })
    .from(organizations)
    .where(eq(organizations.slug, normalizedSlug))
    .limit(1);

  if (existingOrganization) {
    throw new Error("Workspace slug is already in use");
  }

  const organization = await workos.organizations.createOrganization({
    name: input.workspaceName,
  });

  await workos.userManagement.createOrganizationMembership({
    organizationId: organization.id,
    userId: input.user.id,
  });

  await db.transaction(async (tx) => {
    const [createdOrganization] = await tx
      .insert(organizations)
      .values({
        externalId: organization.id,
        isReady: false,
        name: organization.name,
        slug: normalizedSlug,
      })
      .returning({
        id: organizations.id,
        name: organizations.name,
      });

    await tx.insert(memberships).values({
      organizationId: createdOrganization.id,
      userId: syncedUser.id,
      role: "admin",
    });

    await tx.insert(tenantOnboardingSessions).values({
      organizationId: createdOrganization.id,
      status: "draft",
      tenantName: deriveTenantName(createdOrganization.name),
      userId: syncedUser.id,
    });

    return {
      organizationId: createdOrganization.id,
    };
  });
}

export async function createOnboardingDraftForOrganization(input: {
  organizationId: string;
  userExternalId: string;
}) {
  const db = getDb();

  const authorizedMembership = await db
    .select({
      organizationId: memberships.organizationId,
      organizationIsReady: organizations.isReady,
      organizationName: organizations.name,
      userId: users.id,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(
      and(
        eq(memberships.organizationId, input.organizationId),
        eq(users.externalId, input.userExternalId),
      ),
    );

  if (authorizedMembership.length === 0) {
    throw new Error("You do not have access to this organization");
  }

  if (!authorizedMembership[0].organizationIsReady) {
    throw new Error("Organization is not ready for setup yet");
  }

  const existingDraft = await db
    .select({
      id: tenantOnboardingSessions.id,
    })
    .from(tenantOnboardingSessions)
    .where(
      and(
        eq(tenantOnboardingSessions.organizationId, input.organizationId),
        eq(tenantOnboardingSessions.userId, authorizedMembership[0].userId),
      ),
    )
    .orderBy(desc(tenantOnboardingSessions.createdAt))
    .limit(1);

  if (existingDraft[0]) {
    await db
      .update(tenantOnboardingSessions)
      .set({
        slackOauthError: null,
        slackOauthErrorAt: null,
        status: "draft",
        tenantName: deriveTenantName(authorizedMembership[0].organizationName),
        updatedAt: new Date(),
      })
      .where(eq(tenantOnboardingSessions.id, existingDraft[0].id));

    return;
  }

  await db.insert(tenantOnboardingSessions).values({
    organizationId: input.organizationId,
    status: "draft",
    tenantName: deriveTenantName(authorizedMembership[0].organizationName),
    userId: authorizedMembership[0].userId,
  });
}

export async function getOrganizationWorkspaceBySlug(input: {
  orgSlug: string;
  userExternalId: string;
}) {
  const organizations = await getDashboardOrganizations(input.userExternalId);
  const organization = organizations.find(
    (item) => item.slug === input.orgSlug,
  );

  if (!organization) {
    throw new Error("Organization not found");
  }

  return organization;
}

export async function listWorkspaceMembers(input: {
  orgSlug: string;
  userExternalId: string;
}): Promise<WorkspaceMemberDirectory> {
  const context = await getAuthorizedWorkspaceMembershipContext(input);
  const workos = getWorkOS();
  const [membershipsForOrganization, usersForOrganization, invitations] =
    await Promise.all([
      (
        await workos.userManagement.listOrganizationMemberships({
          organizationId: context.organizationExternalId,
        })
      ).autoPagination(),
      (
        await workos.userManagement.listUsers({
          organizationId: context.organizationExternalId,
        })
      ).autoPagination(),
      (
        await workos.userManagement.listInvitations({
          organizationId: context.organizationExternalId,
        })
      ).autoPagination(),
    ]);

  const usersById = new Map(
    usersForOrganization.map((user) => [user.id, user]),
  );
  const missingUserIds = Array.from(
    new Set(
      membershipsForOrganization
        .filter((membership) => membership.status !== "pending")
        .map((membership) => membership.userId)
        .filter((userId) => !usersById.has(userId)),
    ),
  );

  if (missingUserIds.length > 0) {
    const missingUsers = await Promise.all(
      missingUserIds.map((userId) => workos.userManagement.getUser(userId)),
    );

    for (const user of missingUsers) {
      usersById.set(user.id, user);
    }
  }

  const memberEntries = membershipsForOrganization
    .filter((membership) => membership.status !== "pending")
    .map((membership) =>
      buildWorkspaceMemberEntry({
        membership,
        user: usersById.get(membership.userId) ?? null,
      }),
    );
  const invitationEntries = invitations
    .filter((invitation) => invitation.state !== "accepted")
    .map(buildWorkspaceInvitationEntry);
  const entries = [...memberEntries, ...invitationEntries].sort(
    (left, right) => {
      const orderDifference =
        getWorkspaceMemberSortOrder(left) - getWorkspaceMemberSortOrder(right);

      if (orderDifference !== 0) {
        return orderDifference;
      }

      return left.name.localeCompare(right.name);
    },
  );

  return {
    activeMemberCount: memberEntries.filter(
      (entry) => entry.status === "active",
    ).length,
    canManageMembers: canManageWorkspaceMembers(context.localRole),
    entries,
    invitationCount: invitationEntries.length,
    organizationName: context.organizationName,
    organizationSlug: context.organizationSlug,
  };
}

export async function inviteWorkspaceMember(input: {
  email: string;
  orgSlug: string;
  userExternalId: string;
}) {
  const context = await getAuthorizedWorkspaceMembershipContext(input);

  if (!canManageWorkspaceMembers(context.localRole)) {
    throw new Error("Workspace admin access required");
  }

  const normalizedEmail = input.email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const workos = getWorkOS();
  const [existingUsers, existingInvitations] = await Promise.all([
    (
      await workos.userManagement.listUsers({
        email: normalizedEmail,
        organizationId: context.organizationExternalId,
      })
    ).autoPagination(),
    (
      await workos.userManagement.listInvitations({
        email: normalizedEmail,
        organizationId: context.organizationExternalId,
      })
    ).autoPagination(),
  ]);

  if (existingUsers.length > 0) {
    throw new Error("That email already has access to this workspace");
  }

  const pendingInvitation = existingInvitations.find(
    (invitation) => invitation.state === "pending",
  );
  const invitation = pendingInvitation
    ? await workos.userManagement.resendInvitation(pendingInvitation.id)
    : await workos.userManagement.sendInvitation({
        email: normalizedEmail,
        inviterUserId: input.userExternalId,
        organizationId: context.organizationExternalId,
      });

  return {
    action: pendingInvitation ? "resent" : "sent",
    email: invitation.email,
    invitationId: invitation.id,
    state: invitation.state,
  };
}

export async function getOnboardingDraftForUser(input: {
  onboardingSessionId: string;
  userExternalId: string;
}) {
  const db = getDb();

  const [session] = await db
    .select({
      id: tenantOnboardingSessions.id,
      organizationId: tenantOnboardingSessions.organizationId,
      organizationIsReady: organizations.isReady,
      organizationSlug: organizations.slug,
      slackConnectedAt: tenantOnboardingSessions.slackConnectedAt,
      slackOauthError: tenantOnboardingSessions.slackOauthError,
      slackTeamId: tenantOnboardingSessions.slackTeamId,
      serverStatus: tenantServers.status,
      status: tenantOnboardingSessions.status,
      tenantId: tenantOnboardingSessions.tenantId,
      tenantName: tenantOnboardingSessions.tenantName,
      tenantStatus: tenants.status,
      userId: users.id,
    })
    .from(tenantOnboardingSessions)
    .innerJoin(users, eq(tenantOnboardingSessions.userId, users.id))
    .innerJoin(
      organizations,
      eq(tenantOnboardingSessions.organizationId, organizations.id),
    )
    .leftJoin(tenants, eq(tenantOnboardingSessions.tenantId, tenants.id))
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(
      and(
        eq(tenantOnboardingSessions.id, input.onboardingSessionId),
        eq(users.externalId, input.userExternalId),
      ),
    )
    .limit(1);

  if (!session) {
    throw new Error("Onboarding draft not found");
  }

  return session;
}

export async function completeSlackOnboardingAndProvision(input: {
  botToken: string;
  installerUserId: string | null;
  onboardingSessionId: string;
  scopeCsv: string;
  slackBotUserId: string | null;
  slackTeamId: string;
  slackTeamName: string | null;
  userExternalId: string;
}) {
  const db = getDb();
  const authorizedSession = await getOnboardingDraftForUser({
    onboardingSessionId: input.onboardingSessionId,
    userExternalId: input.userExternalId,
  });

  if (!authorizedSession.organizationIsReady) {
    throw new Error("Organization is not ready for Slack or provisioning yet");
  }

  if (authorizedSession.tenantId) {
    const tenantId = authorizedSession.tenantId;
    const now = new Date();
    let tenantIntegrationId = "";
    let desiredStateVersion = 0;
    const shouldEnqueueApply =
      authorizedSession.tenantStatus === "ready" &&
      authorizedSession.serverStatus === "ready";

    await db.transaction(async (tx) => {
      await tx
        .update(tenantOnboardingSessions)
        .set({
          slackBotTokenCiphertext: encryptControlPlaneSecret(input.botToken),
          slackBotUserId: input.slackBotUserId,
          slackConnectedAt: now,
          slackInstalledAt: now,
          slackOauthError: null,
          slackOauthErrorAt: null,
          slackScopeCsv: input.scopeCsv,
          slackTeamId: input.slackTeamId,
          slackTeamName: input.slackTeamName,
          updatedAt: now,
        })
        .where(eq(tenantOnboardingSessions.id, input.onboardingSessionId));

      tenantIntegrationId = await upsertSlackIntegrationForTenant(tx, {
        botToken: input.botToken,
        installerUserId: input.installerUserId,
        now,
        scopeCsv: input.scopeCsv,
        slackBotUserId: input.slackBotUserId,
        slackTeamId: input.slackTeamId,
        slackTeamName: input.slackTeamName,
        tenantId,
      });

      desiredStateVersion = (
        await createNextDesiredStateVersion(tx, {
          tenantId,
        })
      ).version;

      if (shouldEnqueueApply) {
        await markSlackIntegrationPendingApply(tx, {
          now,
          tenantId,
        });
      }
    });

    if (shouldEnqueueApply) {
      await enqueueTenantConfigApply({
        desiredStateVersion,
        tenantId,
      });
    }

    return {
      organizationSlug: authorizedSession.organizationSlug,
      applyQueued: shouldEnqueueApply,
      tenantIntegrationId,
      tenantId,
    };
  }

  const now = new Date();

  const createdTenant = await db.transaction(async (tx) => {
    const finalTenantName = deriveTenantName(
      input.slackTeamName || authorizedSession.tenantName,
    );

    await tx
      .update(tenantOnboardingSessions)
      .set({
        slackBotTokenCiphertext: encryptControlPlaneSecret(input.botToken),
        slackBotUserId: input.slackBotUserId,
        slackConnectedAt: now,
        slackInstalledAt: now,
        slackOauthError: null,
        slackOauthErrorAt: null,
        slackScopeCsv: input.scopeCsv,
        slackTeamId: input.slackTeamId,
        slackTeamName: input.slackTeamName,
        status: "slack_connected",
        tenantName: finalTenantName,
        updatedAt: now,
      })
      .where(eq(tenantOnboardingSessions.id, input.onboardingSessionId));

    const [tenant] = await tx
      .insert(tenants)
      .values({
        organizationId: authorizedSession.organizationId,
        name: finalTenantName,
        status: "provisioning",
      })
      .returning({
        id: tenants.id,
      });

    const tenantIntegrationId = await upsertSlackIntegrationForTenant(tx, {
      botToken: input.botToken,
      installerUserId: input.installerUserId,
      now,
      scopeCsv: input.scopeCsv,
      slackBotUserId: input.slackBotUserId,
      slackTeamId: input.slackTeamId,
      slackTeamName: input.slackTeamName,
      tenantId: tenant.id,
    });

    await tx.insert(tenantServers).values({
      tenantId: tenant.id,
      provider: "hetzner",
      sshUsername: "openclaw",
      status: "creating",
    });

    await createNextDesiredStateVersion(tx, {
      tenantId: tenant.id,
    });

    await tx
      .update(tenantOnboardingSessions)
      .set({
        completedAt: now,
        status: "completed",
        tenantId: tenant.id,
        updatedAt: now,
      })
      .where(eq(tenantOnboardingSessions.id, input.onboardingSessionId));

    return {
      id: tenant.id,
      tenantIntegrationId,
    };
  });

  await enqueueJob({
    jobType: JOB_TYPES.provisionTenantServer,
    payload: {
      tenantId: createdTenant.id,
      step: "create_server",
    },
  });

  return {
    applyQueued: false,
    organizationSlug: authorizedSession.organizationSlug,
    tenantId: createdTenant.id,
    tenantIntegrationId: createdTenant.tenantIntegrationId,
  };
}

export async function recordSlackOauthFailure(input: {
  error: string;
  onboardingSessionId: string;
  userExternalId: string;
}) {
  const db = getDb();
  const authorizedSession = await getOnboardingDraftForUser({
    onboardingSessionId: input.onboardingSessionId,
    userExternalId: input.userExternalId,
  });
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(tenantOnboardingSessions)
      .set({
        slackOauthError: input.error,
        slackOauthErrorAt: now,
        updatedAt: now,
      })
      .where(eq(tenantOnboardingSessions.id, input.onboardingSessionId));

    if (!authorizedSession.tenantId) {
      return;
    }

    await recordSlackIntegrationError(tx, {
      error: input.error,
      now,
      tenantId: authorizedSession.tenantId,
    });
  });
}

export async function syncMessagingDirectoryForTenantIntegration(input: {
  conversations: MessagingConversationInput[];
  externalWorkspaceId: string;
  tenantIntegrationId: string;
  workspaceDisplayName: string | null;
  members: MessagingDirectoryMemberInput[];
}) {
  const db = getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    const messagingWorkspaceId = await upsertMessagingWorkspace(tx, {
      externalWorkspaceId: input.externalWorkspaceId,
      now,
      tenantIntegrationId: input.tenantIntegrationId,
      workspaceDisplayName: input.workspaceDisplayName,
    });

    for (const member of input.members) {
      if (!member.externalMemberId) {
        continue;
      }

      await tx
        .insert(messagingWorkspaceMembers)
        .values({
          avatarUrl: member.avatarUrl,
          displayName: member.displayName,
          email: member.email,
          externalMemberId: member.externalMemberId,
          fullName: member.fullName,
          isDeleted: member.isDeleted,
          lastSyncedAt: now,
          memberType: member.memberType,
          messagingWorkspaceId,
          profileJson: normalizeJsonValue(member.profileJson),
          username: member.username,
        })
        .onConflictDoUpdate({
          target: [
            messagingWorkspaceMembers.messagingWorkspaceId,
            messagingWorkspaceMembers.externalMemberId,
          ],
          set: {
            avatarUrl: member.avatarUrl,
            displayName: member.displayName,
            email: member.email,
            fullName: member.fullName,
            isDeleted: member.isDeleted,
            lastSyncedAt: now,
            memberType: member.memberType,
            profileJson: normalizeJsonValue(member.profileJson),
            updatedAt: now,
            username: member.username,
          },
        });
    }

    for (const conversation of input.conversations) {
      if (!conversation.externalConversationId) {
        continue;
      }

      await tx
        .insert(messagingConversations)
        .values({
          conversationType: conversation.conversationType,
          externalConversationId: conversation.externalConversationId,
          isArchived: conversation.isArchived,
          lastSyncedAt: now,
          messagingWorkspaceId,
          metadataJson: normalizeJsonValue(conversation.metadataJson),
          name: conversation.name,
          purpose: conversation.purpose,
          topic: conversation.topic,
        })
        .onConflictDoUpdate({
          target: [
            messagingConversations.messagingWorkspaceId,
            messagingConversations.externalConversationId,
          ],
          set: {
            conversationType: conversation.conversationType,
            isArchived: conversation.isArchived,
            lastSyncedAt: now,
            metadataJson: normalizeJsonValue(conversation.metadataJson),
            name: conversation.name,
            purpose: conversation.purpose,
            topic: conversation.topic,
            updatedAt: now,
          },
        });
    }

    await tx
      .update(messagingWorkspaces)
      .set({
        lastSyncError: null,
        lastSyncErrorAt: null,
        lastSyncedAt: now,
        syncStatus: "succeeded",
        updatedAt: now,
      })
      .where(eq(messagingWorkspaces.id, messagingWorkspaceId));
  });
}

export async function recordMessagingWorkspaceSyncFailure(input: {
  error: string;
  externalWorkspaceId: string;
  tenantIntegrationId: string;
  workspaceDisplayName: string | null;
}) {
  const db = getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    const messagingWorkspaceId = await upsertMessagingWorkspace(tx, {
      externalWorkspaceId: input.externalWorkspaceId,
      now,
      tenantIntegrationId: input.tenantIntegrationId,
      workspaceDisplayName: input.workspaceDisplayName,
    });

    await tx
      .update(messagingWorkspaces)
      .set({
        lastSyncError: input.error,
        lastSyncErrorAt: now,
        syncStatus: "failed",
        updatedAt: now,
      })
      .where(eq(messagingWorkspaces.id, messagingWorkspaceId));
  });
}

export async function getTenantSlackBotToken(tenantId: string) {
  const db = getDb();
  const [integrationSecret] = await db
    .select({
      ciphertext: integrationSecrets.ciphertext,
    })
    .from(integrationSecrets)
    .innerJoin(
      tenantIntegrations,
      eq(integrationSecrets.tenantIntegrationId, tenantIntegrations.id),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
        eq(integrationSecrets.secretType, SLACK_BOT_TOKEN_SECRET_TYPE),
      ),
    )
    .limit(1);

  if (integrationSecret?.ciphertext) {
    return decryptControlPlaneSecret(integrationSecret.ciphertext);
  }

  const [row] = await db
    .select({
      slackBotTokenCiphertext: tenantOnboardingSessions.slackBotTokenCiphertext,
    })
    .from(tenantOnboardingSessions)
    .where(eq(tenantOnboardingSessions.tenantId, tenantId))
    .orderBy(desc(tenantOnboardingSessions.createdAt))
    .limit(1);

  if (!row?.slackBotTokenCiphertext) {
    return null;
  }

  return decryptControlPlaneSecret(row.slackBotTokenCiphertext);
}

export async function getLatestTenantDesiredState(tenantId: string) {
  const db = getDb();
  const [desiredState] = await db
    .select({
      configJson: tenantDesiredStates.configJson,
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(eq(tenantDesiredStates.tenantId, tenantId))
    .orderBy(desc(tenantDesiredStates.version))
    .limit(1);

  if (!desiredState) {
    throw new Error(`No desired state found for tenant ${tenantId}`);
  }

  return desiredState;
}

function extractRuntimeImageVersion(image: string) {
  const digestSeparatorIndex = image.indexOf("@");

  if (digestSeparatorIndex >= 0) {
    return image.slice(digestSeparatorIndex + 1);
  }

  const lastColonIndex = image.lastIndexOf(":");
  const lastSlashIndex = image.lastIndexOf("/");

  if (lastColonIndex > lastSlashIndex) {
    return image.slice(lastColonIndex + 1);
  }

  return null;
}

async function getLatestTenantForOrganizationSlug(
  orgSlug: string,
): Promise<PlatformTenantTarget | null> {
  const db = getDb();
  const [tenant] = await db
    .select({
      ipv4: tenantServers.ipv4,
      organizationId: organizations.id,
      orgSlug: organizations.slug,
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantStatus: tenants.status,
    })
    .from(tenants)
    .innerJoin(organizations, eq(tenants.organizationId, organizations.id))
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(organizations.slug, orgSlug))
    .orderBy(desc(tenants.createdAt))
    .limit(1);

  if (!tenant) {
    return null;
  }

  return tenant;
}

export async function getPlatformTenantTarget(input: {
  orgSlug: string;
  userExternalId: string;
}): Promise<PlatformTenantTarget | null> {
  await requirePlatformAdmin(input.userExternalId);

  return getLatestTenantForOrganizationSlug(input.orgSlug);
}

export async function triggerPlatformOrganizationApply(input: {
  orgSlug: string;
  userExternalId: string;
}) {
  const tenant = await getPlatformTenantTarget(input);

  if (!tenant) {
    throw new Error("Organization tenant not found");
  }

  const desiredState = await getLatestTenantDesiredState(tenant.tenantId);
  const jobId = await enqueueTenantConfigApply({
    desiredStateVersion: desiredState.version,
    tenantId: tenant.tenantId,
  });

  return {
    desiredStateVersion: desiredState.version,
    jobId,
    queued: true,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
  };
}

export async function getLatestTenantManagedConfig(
  tenantId: string,
): Promise<TenantManagedConfig> {
  const db = getDb();
  const latestVersion = await db.transaction(async (tx) =>
    ensureLatestTenantManagedConfigVersion(tx, {
      tenantId,
    }),
  );

  return getTenantManagedConfigByVersion({
    tenantId,
    version: latestVersion.version,
  });
}

export async function getTenantManagedConfigByVersion(input: {
  tenantId: string;
  version: number;
}): Promise<TenantManagedConfig> {
  const db = getDb();
  const organizationSlugPromise = getOrganizationSlugForTenant(input.tenantId);
  const [configVersion] = await db
    .select({
      createdAt: tenantManagedConfigVersions.createdAt,
      createdByExternalId: tenantManagedConfigVersions.createdByExternalId,
      createdByType: tenantManagedConfigVersions.createdByType,
      id: tenantManagedConfigVersions.id,
      summary: tenantManagedConfigVersions.summary,
      version: tenantManagedConfigVersions.version,
    })
    .from(tenantManagedConfigVersions)
    .where(
      and(
        eq(tenantManagedConfigVersions.tenantId, input.tenantId),
        eq(tenantManagedConfigVersions.version, input.version),
      ),
    )
    .limit(1);

  if (!configVersion) {
    throw new Error(
      `Managed config version ${input.version} not found for tenant ${input.tenantId}`,
    );
  }

  const fileRows = await db
    .select({
      checksum: tenantManagedFileVersions.checksum,
      path: tenantManagedFileVersions.path,
      sharedContent: tenantManagedFileVersions.sharedContent,
      systemContent: tenantManagedFileVersions.systemContent,
    })
    .from(tenantManagedFileVersions)
    .where(
      eq(
        tenantManagedFileVersions.tenantManagedConfigVersionId,
        configVersion.id,
      ),
    );

  const runtimeContext = {
    ottoBaseUrl: getControlPlaneBaseUrl(),
    workspaceSlug: await organizationSlugPromise,
  };

  const files = getManagedBootstrapFileDefinitions().map((definition) => {
    const fileRow = fileRows.find((row) => row.path === definition.path);
    const sharedContent =
      fileRow?.sharedContent ?? definition.defaultSharedContent;
    const systemContent = definition.systemContent;
    const effectiveSystemContent = buildManagedBootstrapSystemContent({
      path: definition.path,
      runtimeContext,
      systemContent,
    });

    return {
      checksum: createManagedFileChecksum({
        path: definition.path,
        sharedContent,
        systemContent,
      }),
      description: definition.description,
      label: definition.label,
      path: definition.path,
      renderedContent: buildManagedBootstrapFileContent({
        path: definition.path,
        runtimeContext,
        sharedContent,
        systemContent,
      }),
      sharedContent,
      systemContent: effectiveSystemContent,
    };
  });

  return {
    createdAt: configVersion.createdAt,
    createdByExternalId: configVersion.createdByExternalId,
    createdByType: configVersion.createdByType,
    files,
    summary: configVersion.summary,
    version: configVersion.version,
  };
}

export async function getTenantDesiredStateByVersion(input: {
  tenantId: string;
  version: number;
}) {
  const db = getDb();
  const [desiredState] = await db
    .select({
      configJson: tenantDesiredStates.configJson,
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(
      and(
        eq(tenantDesiredStates.tenantId, input.tenantId),
        eq(tenantDesiredStates.version, input.version),
      ),
    )
    .limit(1);

  if (!desiredState) {
    throw new Error(
      `Desired state version ${input.version} not found for tenant ${input.tenantId}`,
    );
  }

  return desiredState;
}

export async function updateTenantManagedFileSharedContent(input: {
  expectedVersion?: number;
  filePath: ManagedBootstrapFilePath;
  orgSlug: string;
  sharedContent: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  return updateTenantManagedFileSharedContentForTenant({
    createdByExternalId: input.userExternalId,
    createdByType: "user",
    expectedVersion: input.expectedVersion,
    filePath: input.filePath,
    sharedContent: input.sharedContent,
    summary: `Updated ${input.filePath}`,
    tenantId: authorizedTenant.tenantId,
  });
}

export async function getTenantSlackRuntimeConfig(input: {
  orgSlug: string;
  userExternalId: string;
}): Promise<TenantSlackRuntimeConfig | null> {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    return null;
  }

  const db = getDb();

  return db.transaction(async (tx) => {
    const slackIntegration = await getConnectedSlackIntegrationForTenant(tx, {
      tenantId: authorizedTenant.tenantId,
    });

    if (!slackIntegration) {
      return null;
    }

    const slackConfig = await getOrCreateTenantSlackRuntimeConfigEntry(tx, {
      tenantId: authorizedTenant.tenantId,
    });

    return buildTenantSlackRuntimeConfig(slackConfig);
  });
}

export async function getTenantSlackRuntimeConfigSurface(input: {
  orgSlug: string;
  userExternalId: string;
}): Promise<TenantSlackRuntimeConfigSurface | null> {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    return null;
  }

  return getTenantSlackRuntimeConfigSurfaceForTenant({
    tenantId: authorizedTenant.tenantId,
  });
}

export async function refreshTenantSlackDirectory(input: {
  orgSlug: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    return {
      error: "Organization tenant not found",
      refreshed: false,
    };
  }

  return refreshTenantSlackDirectoryForTenant({
    tenantId: authorizedTenant.tenantId,
  });
}

export async function listTenantRuntimeConfigSurfaces(input: {
  orgSlug: string;
  userExternalId: string;
}) {
  return listTenantToolConfigSurfaces(input);
}

export async function listTenantToolConfigSurfaces(input: {
  orgSlug: string;
  userExternalId: string;
}): Promise<TenantToolConfigSurface[]> {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    return [];
  }

  return listTenantToolConfigSurfacesForTenant({
    tenantId: authorizedTenant.tenantId,
  });
}

export async function listTenantToolConfigSurfacesForTenant(input: {
  tenantId: string;
}): Promise<TenantToolConfigSurface[]> {
  const surfaces = await Promise.all(
    listToolDefinitions().map((definition) =>
      getTenantToolConfigSurfaceForTenant({
        surfaceKey: definition.key,
        surfaceKind: definition.kind,
        tenantId: input.tenantId,
      }),
    ),
  );

  return surfaces.filter((surface): surface is TenantToolConfigSurface =>
    Boolean(surface),
  );
}

export async function getTenantToolConfigSurface(input: {
  orgSlug: string;
  surfaceKey: string;
  surfaceKind: string;
  userExternalId: string;
}): Promise<TenantToolConfigSurface | null> {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    return null;
  }

  return getTenantToolConfigSurfaceForTenant({
    surfaceKey: input.surfaceKey,
    surfaceKind: input.surfaceKind,
    tenantId: authorizedTenant.tenantId,
  });
}

export async function getTenantToolConfigSurfaceForTenant(input: {
  surfaceKey: string;
  surfaceKind: string;
  tenantId: string;
}): Promise<TenantToolConfigSurface | null> {
  const definition = getToolDefinition(input.surfaceKind, input.surfaceKey);

  if (!definition) {
    return null;
  }

  if (
    input.surfaceKind === SLACK_RUNTIME_CONFIG_SURFACE_KIND &&
    input.surfaceKey === SLACK_RUNTIME_CONFIG_SURFACE_KEY
  ) {
    return getTenantSlackRuntimeConfigSurfaceForTenant({
      tenantId: input.tenantId,
    }) as Promise<TenantToolConfigSurface | null>;
  }

  if (
    input.surfaceKind === WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND &&
    input.surfaceKey === WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY
  ) {
    return getTenantWhatsAppRuntimeConfigSurfaceForTenant({
      tenantId: input.tenantId,
    }) as Promise<TenantToolConfigSurface | null>;
  }

  if (
    input.surfaceKind === WEB_SEARCH_TOOL_SURFACE_KIND &&
    input.surfaceKey === WEB_SEARCH_TOOL_SURFACE_KEY
  ) {
    return getTenantWebSearchToolSurfaceForTenant({
      tenantId: input.tenantId,
    });
  }

  return null;
}

export async function validateTenantToolConfigChange(input: {
  createdByType?: "runtime" | "system" | "user";
  orgSlug: string;
  patch: Record<string, unknown>;
  surfaceKey: string;
  surfaceKind: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  return validateTenantToolConfigChangeForTenant({
    createdByType: input.createdByType,
    patch: input.patch,
    surfaceKey: input.surfaceKey,
    surfaceKind: input.surfaceKind,
    tenantId: authorizedTenant.tenantId,
  });
}

export async function validateTenantToolConfigChangeForTenant(input: {
  createdByType?: "runtime" | "system" | "user";
  patch: Record<string, unknown>;
  surfaceKey: string;
  surfaceKind: string;
  tenantId: string;
}) {
  const definition = getToolDefinition(input.surfaceKind, input.surfaceKey);

  if (!definition) {
    throw new Error("Unsupported tool config surface");
  }

  if (isSlackSurface(input.surfaceKind, input.surfaceKey)) {
    if (input.createdByType === "runtime") {
      throw new Error(
        "Raw Slack config patches are disabled for runtime callers. Use the Slack policy action tools instead.",
      );
    }

    return validateTenantSlackRuntimeConfigChangeForTenant({
      createdByType: input.createdByType ?? "user",
      patch: definition.parsePatch(input.patch) as Partial<SlackRuntimeConfig>,
      tenantId: input.tenantId,
    });
  }

  if (isWhatsAppSurface(input.surfaceKind, input.surfaceKey)) {
    return validateTenantWhatsAppRuntimeConfigChangeForTenant({
      createdByType: input.createdByType ?? "user",
      patch: definition.parsePatch(
        input.patch,
      ) as Partial<WhatsAppRuntimeConfig>,
      tenantId: input.tenantId,
    });
  }

  const mutationError = getSurfaceConfigMutationError(definition);

  if (mutationError) {
    throw new Error(mutationError);
  }

  throw new Error("Unsupported tool config surface");
}

export async function applyTenantToolConfigChange(input: {
  allowDestructiveChanges?: boolean;
  createdByExternalId?: string | null;
  createdByType: "runtime" | "system" | "user";
  expectedEntryVersion?: number;
  orgSlug: string;
  patch: Record<string, unknown>;
  summary?: string;
  surfaceKey: string;
  surfaceKind: string;
  userExternalId?: string;
}) {
  const actorExternalId =
    input.createdByType === "user"
      ? (input.userExternalId ?? input.createdByExternalId ?? null)
      : (input.createdByExternalId ?? null);
  const authorizedTenant =
    input.createdByType === "user"
      ? await getAuthorizedLatestTenantForOrganization({
          orgSlug: input.orgSlug,
          userExternalId: input.userExternalId ?? "",
        })
      : null;

  if (input.createdByType === "user" && !authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  return applyTenantToolConfigChangeForTenant({
    allowDestructiveChanges: input.allowDestructiveChanges,
    createdByExternalId: actorExternalId,
    createdByType: input.createdByType,
    expectedEntryVersion: input.expectedEntryVersion,
    patch: input.patch,
    summary: input.summary,
    surfaceKey: input.surfaceKey,
    surfaceKind: input.surfaceKind,
    tenantId: authorizedTenant?.tenantId,
  });
}

export async function applyTenantToolConfigChangeForTenant(input: {
  allowDestructiveChanges?: boolean;
  createdByExternalId?: string | null;
  createdByType: "runtime" | "system" | "user";
  expectedEntryVersion?: number;
  patch: Record<string, unknown>;
  summary?: string;
  surfaceKey: string;
  surfaceKind: string;
  tenantId?: string;
}) {
  if (!input.tenantId) {
    throw new Error("Tenant runtime config target is missing");
  }

  const definition = getToolDefinition(input.surfaceKind, input.surfaceKey);

  if (!definition) {
    throw new Error("Unsupported tool config surface");
  }

  if (isSlackSurface(input.surfaceKind, input.surfaceKey)) {
    if (input.createdByType === "runtime") {
      throw new Error(
        "Raw Slack config patches are disabled for runtime callers. Use the Slack policy action tools instead.",
      );
    }

    const result = await updateTenantSlackRuntimeConfigForTenant({
      allowDestructiveChanges: input.allowDestructiveChanges,
      createdByExternalId: input.createdByExternalId,
      createdByType: input.createdByType,
      expectedEntryVersion: input.expectedEntryVersion,
      patch: definition.parsePatch(input.patch) as Partial<SlackRuntimeConfig>,
      summary: input.summary,
      tenantId: input.tenantId,
    });
    const surface = await getTenantToolConfigSurfaceForTenant({
      surfaceKey: input.surfaceKey,
      surfaceKind: input.surfaceKind,
      tenantId: input.tenantId,
    });

    return {
      ...result,
      surface,
      validation: {
        ok: true,
      },
    };
  }

  if (isWhatsAppSurface(input.surfaceKind, input.surfaceKey)) {
    const result = await updateTenantWhatsAppRuntimeConfigForTenant({
      allowDestructiveChanges: input.allowDestructiveChanges,
      createdByExternalId: input.createdByExternalId,
      createdByType: input.createdByType,
      expectedEntryVersion: input.expectedEntryVersion,
      patch: definition.parsePatch(
        input.patch,
      ) as Partial<WhatsAppRuntimeConfig>,
      summary: input.summary,
      tenantId: input.tenantId,
    });
    const surface = await getTenantToolConfigSurfaceForTenant({
      surfaceKey: input.surfaceKey,
      surfaceKind: input.surfaceKind,
      tenantId: input.tenantId,
    });

    return {
      ...result,
      surface,
      validation: {
        ok: true,
      },
    };
  }

  const mutationError = getSurfaceConfigMutationError(definition);

  if (mutationError) {
    throw new Error(mutationError);
  }

  throw new Error("Unsupported tool config surface");
}

export async function setTenantToolInstallState(input: {
  createdByExternalId?: string | null;
  createdByType: "runtime" | "system" | "user";
  enabled?: boolean;
  expectedEntryVersion?: number;
  installState: ToolInstallState;
  orgSlug: string;
  summary?: string;
  surfaceKey: string;
  surfaceKind: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  return setTenantToolInstallStateForTenant({
    createdByExternalId: input.createdByExternalId ?? input.userExternalId,
    createdByType: input.createdByType,
    enabled: input.enabled,
    expectedEntryVersion: input.expectedEntryVersion,
    installState: input.installState,
    summary: input.summary,
    surfaceKey: input.surfaceKey,
    surfaceKind: input.surfaceKind,
    tenantId: authorizedTenant.tenantId,
  });
}

export async function reapplyTenantToolSurface(input: {
  createdByExternalId?: string | null;
  createdByType: "runtime" | "system" | "user";
  orgSlug: string;
  summary?: string;
  surfaceKey: string;
  surfaceKind: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  return reapplyTenantToolSurfaceForTenant({
    createdByExternalId: input.createdByExternalId ?? input.userExternalId,
    createdByType: input.createdByType,
    summary: input.summary,
    surfaceKey: input.surfaceKey,
    surfaceKind: input.surfaceKind,
    tenantId: authorizedTenant.tenantId,
  });
}

export async function getTenantSlackRuntimeConfigSurfaceForTenant(input: {
  tenantId: string;
}): Promise<TenantSlackRuntimeConfigSurface | null> {
  const db = getDb();
  const definition = getToolDefinition(
    SLACK_RUNTIME_CONFIG_SURFACE_KIND,
    SLACK_RUNTIME_CONFIG_SURFACE_KEY,
  );

  return db.transaction(async (tx) => {
    const [slackConfig, directory, slackIntegration, organizationSlug] =
      await Promise.all([
        getOrCreateTenantSlackRuntimeConfigEntry(tx, {
          tenantId: input.tenantId,
        }),
        getSlackDirectoryOptions(tx, {
          tenantId: input.tenantId,
        }),
        getConnectedSlackIntegrationForTenant(tx, {
          tenantId: input.tenantId,
        }),
        getOrganizationSlugForTenantTx(tx, {
          tenantId: input.tenantId,
        }),
      ]);

    const allowedActions = definition
      ? listAvailableToolActions(definition, {
          enabled: slackConfig.enabled,
          installState: slackConfig.installState,
        })
      : [];
    const effects = await evaluateSlackPolicyForTenant(tx, {
      config: slackConfig.config,
      tenantId: input.tenantId,
    });

    return {
      agentCapabilities: definition?.agentCapabilities ?? [],
      agentOperations: definition?.agentOperations ?? [],
      availableChannels: directory.channels,
      availableUsers: directory.users,
      actionMeanings: definition?.actionMeanings ?? [],
      allowedActions,
      availability: slackIntegration ? "available" : "blocked",
      blockingReason: slackIntegration
        ? null
        : "Connect Slack before changing Slack runtime behavior.",
      canAgentEdit: Boolean(slackIntegration),
      canUserEdit: true,
      config: buildTenantSlackRuntimeConfig(slackConfig),
      description: SLACK_RUNTIME_CONFIG_DESCRIPTION,
      derivedEffects: effects,
      fieldMeanings: definition?.fieldMeanings ?? [],
      id: getToolSurfaceId(
        SLACK_RUNTIME_CONFIG_SURFACE_KIND,
        SLACK_RUNTIME_CONFIG_SURFACE_KEY,
      ),
      key: SLACK_RUNTIME_CONFIG_SURFACE_KEY,
      kind: SLACK_RUNTIME_CONFIG_SURFACE_KIND,
      label: SLACK_RUNTIME_CONFIG_LABEL,
      schema: slackRuntimeConfigJsonSchema,
      settingsUrl: organizationSlug
        ? `/${organizationSlug}/integrations/slack`
        : null,
      setupUrl: organizationSlug
        ? `/${organizationSlug}/integrations/slack`
        : null,
      surfaceType: "integration",
      uiGroup: "integrations",
      uiHints: slackRuntimeConfigUiHints,
    };
  });
}

export async function getTenantWhatsAppRuntimeConfigSurface(input: {
  orgSlug: string;
  userExternalId: string;
}): Promise<TenantWhatsAppRuntimeConfigSurface | null> {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    return null;
  }

  return getTenantWhatsAppRuntimeConfigSurfaceForTenant({
    tenantId: authorizedTenant.tenantId,
  });
}

export async function getTenantWhatsAppRuntimeConfigSurfaceForTenant(input: {
  tenantId: string;
}): Promise<TenantWhatsAppRuntimeConfigSurface | null> {
  const db = getDb();
  const definition = getToolDefinition(
    WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND,
    WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY,
  );

  return db.transaction(async (tx) => {
    const [whatsAppIntegration, organizationSlug] = await Promise.all([
      getWhatsAppIntegrationForTenant(tx, {
        tenantId: input.tenantId,
      }),
      getOrganizationSlugForTenantTx(tx, {
        tenantId: input.tenantId,
      }),
    ]);

    if (!whatsAppIntegration) {
      return null;
    }

    const currentConfig = await getOrCreateTenantWhatsAppRuntimeConfigEntry(
      tx,
      {
        tenantId: input.tenantId,
      },
    );
    const allowedActions = definition
      ? listAvailableToolActions(definition, {
          enabled: currentConfig.enabled,
          installState: currentConfig.installState,
        })
      : [];
    const effects = deriveWhatsAppPolicyEffects({
      config: currentConfig.config,
    });
    const isBlocked =
      whatsAppIntegration.status === "pending_apply" ||
      whatsAppIntegration.status === "applying" ||
      whatsAppIntegration.status === "activating";

    return {
      actionMeanings: definition?.actionMeanings ?? [],
      agentCapabilities: definition?.agentCapabilities ?? [],
      agentOperations: definition?.agentOperations ?? [],
      allowedActions,
      availability: isBlocked ? "blocked" : "available",
      blockingReason: isBlocked
        ? "Otto is still preparing WhatsApp. Finish the latest apply before changing these settings."
        : null,
      canAgentEdit: true,
      canUserEdit: true,
      config: buildTenantWhatsAppRuntimeConfig(currentConfig),
      description: WHATSAPP_RUNTIME_CONFIG_DESCRIPTION,
      derivedEffects: effects,
      fieldMeanings: definition?.fieldMeanings ?? [],
      id: getToolSurfaceId(
        WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND,
        WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY,
      ),
      key: WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY,
      kind: WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND,
      label: WHATSAPP_RUNTIME_CONFIG_LABEL,
      schema: whatsappRuntimeConfigJsonSchema,
      settingsUrl: organizationSlug
        ? `/${organizationSlug}/integrations/whatsapp`
        : null,
      setupUrl: organizationSlug
        ? `/${organizationSlug}/integrations/whatsapp`
        : null,
      surfaceType: "integration",
      uiGroup: "integrations",
      uiHints: whatsappRuntimeConfigUiHints,
    };
  });
}

export async function enableTenantWhatsAppIntegration(input: {
  orgSlug: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const existingIntegration = await getWhatsAppIntegrationForTenant(tx, {
      tenantId: authorizedTenant.tenantId,
    });

    if (existingIntegration) {
      const currentConfig = await getOrCreateTenantWhatsAppRuntimeConfigEntry(
        tx,
        {
          tenantId: authorizedTenant.tenantId,
        },
      );

      if (currentConfig.installState === "installed" && currentConfig.enabled) {
        return {
          applyQueued: false,
          changed: false,
          desiredStateVersion: null as number | null,
          tenantId: authorizedTenant.tenantId,
        };
      }

      const now = new Date();
      const nextEntryVersion = currentConfig.entryVersion + 1;

      await tx
        .update(tenantRuntimeConfigEntries)
        .set({
          changeSummary: "Installed WhatsApp runtime surface",
          enabled: true,
          entryVersion: nextEntryVersion,
          installState: "installed",
          lastValidatedAt: now,
          lastValidationError: null,
          schemaVersion: WHATSAPP_RUNTIME_CONFIG_SCHEMA_VERSION,
          updatedAt: now,
          updatedByExternalId: input.userExternalId,
          updatedByType: "user",
        })
        .where(eq(tenantRuntimeConfigEntries.id, currentConfig.id));

      const desiredStateVersion = (
        await createNextDesiredStateVersion(tx, {
          tenantId: authorizedTenant.tenantId,
        })
      ).version;
      const tenantRuntime = await getTenantRuntimeState(
        tx,
        authorizedTenant.tenantId,
      );

      await tx.insert(tenantRuntimeConfigMutations).values({
        actorExternalId: input.userExternalId,
        actorType: "user",
        desiredStateVersion,
        mutationType: "install",
        resultJson: {
          enabled: true,
          installState: "installed",
        },
        resultingEntryVersion: nextEntryVersion,
        tenantId: authorizedTenant.tenantId,
        tenantRuntimeConfigEntryId: currentConfig.id,
      });

      await markWhatsAppIntegrationPendingApply(tx, {
        now,
        tenantId: authorizedTenant.tenantId,
      });

      return {
        applyQueued: tenantRuntime.isRuntimeReady,
        changed: true,
        desiredStateVersion,
        tenantId: authorizedTenant.tenantId,
      };
    }

    const now = new Date();
    await upsertWhatsAppIntegrationForTenant(tx, {
      now,
      statusWhenNotConnected: "pending_apply",
      tenantId: authorizedTenant.tenantId,
    });
    const currentConfig = await getOrCreateTenantWhatsAppRuntimeConfigEntry(
      tx,
      {
        tenantId: authorizedTenant.tenantId,
      },
    );
    const nextEntryVersion = currentConfig.entryVersion + 1;

    await tx
      .update(tenantRuntimeConfigEntries)
      .set({
        changeSummary: "Installed WhatsApp runtime surface",
        enabled: true,
        entryVersion: nextEntryVersion,
        installState: "installed",
        lastValidatedAt: now,
        lastValidationError: null,
        schemaVersion: WHATSAPP_RUNTIME_CONFIG_SCHEMA_VERSION,
        updatedAt: now,
        updatedByExternalId: input.userExternalId,
        updatedByType: "user",
      })
      .where(eq(tenantRuntimeConfigEntries.id, currentConfig.id));

    const desiredStateVersion = (
      await createNextDesiredStateVersion(tx, {
        tenantId: authorizedTenant.tenantId,
      })
    ).version;
    const tenantRuntime = await getTenantRuntimeState(
      tx,
      authorizedTenant.tenantId,
    );

    await markWhatsAppIntegrationPendingApply(tx, {
      now,
      tenantId: authorizedTenant.tenantId,
    });

    await tx.insert(tenantRuntimeConfigMutations).values({
      actorExternalId: input.userExternalId,
      actorType: "user",
      desiredStateVersion,
      mutationType: "install",
      resultJson: {
        enabled: true,
        installState: "installed",
      },
      resultingEntryVersion: nextEntryVersion,
      tenantId: authorizedTenant.tenantId,
      tenantRuntimeConfigEntryId: currentConfig.id,
    });

    return {
      applyQueued: tenantRuntime.isRuntimeReady,
      changed: true,
      desiredStateVersion,
      tenantId: authorizedTenant.tenantId,
    };
  });

  if (result.applyQueued && result.desiredStateVersion) {
    await enqueueTenantConfigApply({
      desiredStateVersion: result.desiredStateVersion,
      tenantId: result.tenantId,
    });
  }

  return {
    ...result,
    surface: await getTenantWhatsAppRuntimeConfigSurfaceForTenant({
      tenantId: result.tenantId,
    }),
  };
}

export async function disableTenantWhatsAppIntegration(input: {
  orgSlug: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const integration = await getWhatsAppIntegrationForTenant(tx, {
      tenantId: authorizedTenant.tenantId,
    });

    if (!integration) {
      throw new Error("WhatsApp is not enabled for this workspace");
    }

    const currentConfig = await getOrCreateTenantWhatsAppRuntimeConfigEntry(
      tx,
      {
        tenantId: authorizedTenant.tenantId,
      },
    );
    const [session] = await tx
      .select({
        completedAt: whatsappLinkSessions.completedAt,
        createdAt: whatsappLinkSessions.createdAt,
        expiresAt: whatsappLinkSessions.expiresAt,
        forceRelink: whatsappLinkSessions.forceRelink,
        id: whatsappLinkSessions.id,
        lastError: whatsappLinkSessions.lastError,
        qrDataUrl: whatsappLinkSessions.qrDataUrl,
        status: whatsappLinkSessions.status,
        updatedAt: whatsappLinkSessions.updatedAt,
      })
      .from(whatsappLinkSessions)
      .where(eq(whatsappLinkSessions.tenantIntegrationId, integration.id))
      .orderBy(desc(whatsappLinkSessions.createdAt))
      .limit(1);
    const now = new Date();

    if (
      session &&
      (session.status === "queued" ||
        session.status === "starting" ||
        session.status === "qr_ready")
    ) {
      await tx
        .update(whatsappLinkSessions)
        .set({
          completedAt: now,
          expiresAt: null,
          lastError: null,
          qrDataUrl: null,
          status: "dismissed",
          updatedAt: now,
        })
        .where(eq(whatsappLinkSessions.id, session.id));
    }

    let desiredStateVersion: number | null = null;

    if (currentConfig.installState !== "uninstalled" || currentConfig.enabled) {
      const nextEntryVersion = currentConfig.entryVersion + 1;

      await tx
        .update(tenantRuntimeConfigEntries)
        .set({
          changeSummary: "Uninstalled WhatsApp runtime surface",
          enabled: false,
          entryVersion: nextEntryVersion,
          installState: "uninstalled",
          lastValidatedAt: now,
          lastValidationError: null,
          schemaVersion: WHATSAPP_RUNTIME_CONFIG_SCHEMA_VERSION,
          updatedAt: now,
          updatedByExternalId: input.userExternalId,
          updatedByType: "user",
        })
        .where(eq(tenantRuntimeConfigEntries.id, currentConfig.id));

      desiredStateVersion = (
        await createNextDesiredStateVersion(tx, {
          tenantId: authorizedTenant.tenantId,
        })
      ).version;

      await tx.insert(tenantRuntimeConfigMutations).values({
        actorExternalId: input.userExternalId,
        actorType: "user",
        desiredStateVersion,
        mutationType: "uninstall",
        resultJson: {
          enabled: false,
          installState: "uninstalled",
        },
        resultingEntryVersion: nextEntryVersion,
        tenantId: authorizedTenant.tenantId,
        tenantRuntimeConfigEntryId: currentConfig.id,
      });
    }

    const tenantRuntime = await getTenantRuntimeState(
      tx,
      authorizedTenant.tenantId,
    );

    return {
      desiredStateVersion,
      disconnectQueued: tenantRuntime.isRuntimeReady,
      linkSession: buildTenantWhatsAppLinkSession(
        session &&
          (session.status === "queued" ||
            session.status === "starting" ||
            session.status === "qr_ready")
          ? {
              ...session,
              completedAt: now,
              expiresAt: null,
              lastError: null,
              qrDataUrl: null,
              status: "dismissed",
              updatedAt: now,
            }
          : (session ?? null),
      ),
      tenantId: authorizedTenant.tenantId,
    };
  });

  if (result.disconnectQueued) {
    await enqueueJob({
      jobType: JOB_TYPES.whatsappDisconnect,
      payload: {
        desiredStateVersion: result.desiredStateVersion ?? undefined,
        tenantId: result.tenantId,
      },
    });
  }

  return {
    ...result,
    surface: await getTenantWhatsAppRuntimeConfigSurfaceForTenant({
      tenantId: result.tenantId,
    }),
  };
}

export async function activateTenantWhatsAppAfterPairing(input: {
  createdByExternalId?: string | null;
  createdByType: "runtime" | "system" | "user";
  tenantId: string;
}) {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const integration = await getWhatsAppIntegrationForTenant(tx, {
      tenantId: input.tenantId,
    });

    if (!integration) {
      throw new Error("WhatsApp integration not found");
    }

    const currentConfig = await getOrCreateTenantWhatsAppRuntimeConfigEntry(
      tx,
      {
        tenantId: input.tenantId,
      },
    );

    if (currentConfig.installState === "installed" && currentConfig.enabled) {
      return {
        applyQueued: false,
        changed: false,
        desiredStateVersion: null as number | null,
      };
    }

    const now = new Date();
    const nextEntryVersion = currentConfig.entryVersion + 1;

    await tx
      .update(tenantRuntimeConfigEntries)
      .set({
        changeSummary: "Installed WhatsApp runtime surface after pairing",
        enabled: true,
        entryVersion: nextEntryVersion,
        installState: "installed",
        lastValidatedAt: now,
        lastValidationError: null,
        schemaVersion: WHATSAPP_RUNTIME_CONFIG_SCHEMA_VERSION,
        updatedAt: now,
        updatedByExternalId: input.createdByExternalId ?? null,
        updatedByType: input.createdByType,
      })
      .where(eq(tenantRuntimeConfigEntries.id, currentConfig.id));

    const desiredStateVersion = (
      await createNextDesiredStateVersion(tx, {
        tenantId: input.tenantId,
      })
    ).version;
    const tenantRuntime = await getTenantRuntimeState(tx, input.tenantId);

    await tx
      .update(tenantIntegrations)
      .set({
        connectedAt: null,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: "activating",
        updatedAt: now,
      })
      .where(
        and(
          eq(tenantIntegrations.tenantId, input.tenantId),
          eq(tenantIntegrations.providerKey, WHATSAPP_PROVIDER_KEY),
        ),
      );

    await tx.insert(tenantRuntimeConfigMutations).values({
      actorExternalId: input.createdByExternalId ?? null,
      actorType: input.createdByType,
      desiredStateVersion,
      mutationType: "install",
      resultJson: {
        enabled: true,
        installState: "installed",
      },
      resultingEntryVersion: nextEntryVersion,
      tenantId: input.tenantId,
      tenantRuntimeConfigEntryId: currentConfig.id,
    });

    return {
      applyQueued: tenantRuntime.isRuntimeReady,
      changed: true,
      desiredStateVersion,
    };
  });

  if (result.applyQueued && result.desiredStateVersion) {
    await enqueueTenantConfigApply({
      desiredStateVersion: result.desiredStateVersion,
      tenantId: input.tenantId,
    });
  }

  return result;
}

export async function createTenantWhatsAppLinkSession(input: {
  forceRelink?: boolean;
  orgSlug: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const tenantRuntime = await getTenantRuntimeState(
      tx,
      authorizedTenant.tenantId,
    );

    if (!tenantRuntime.isRuntimeReady) {
      throw new Error("WhatsApp linking requires a ready workspace runtime");
    }

    let integration = await getWhatsAppIntegrationForTenant(tx, {
      tenantId: authorizedTenant.tenantId,
    });

    if (!integration) {
      const now = new Date();
      const integrationId = await upsertWhatsAppIntegrationForTenant(tx, {
        now,
        statusWhenNotConnected: "ready_to_link",
        tenantId: authorizedTenant.tenantId,
      });
      integration = {
        connectedAt: null,
        disconnectedAt: null,
        id: integrationId,
        lastError: null,
        lastErrorAt: null,
        selfE164: null,
        selfJid: null,
        status: "ready_to_link",
      };
    }

    await getOrCreateTenantWhatsAppRuntimeConfigEntry(tx, {
      tenantId: authorizedTenant.tenantId,
    });

    if (
      integration.status === "pending_apply" ||
      integration.status === "applying" ||
      integration.status === "activating"
    ) {
      throw new Error(
        "Otto is still applying WhatsApp. Wait for the latest update to finish before generating a QR code.",
      );
    }

    if (integration.status === "apply_failed") {
      throw new Error(
        "WhatsApp setup is not applied on the tenant runtime yet. Reapply the WhatsApp settings before generating a QR code.",
      );
    }

    const now = new Date();
    const [linkSession] = await tx
      .insert(whatsappLinkSessions)
      .values({
        expiresAt: new Date(now.getTime() + 3 * 60_000),
        forceRelink: Boolean(input.forceRelink),
        startedByExternalId: input.userExternalId,
        status: "queued",
        tenantIntegrationId: integration.id,
      })
      .returning({
        completedAt: whatsappLinkSessions.completedAt,
        createdAt: whatsappLinkSessions.createdAt,
        expiresAt: whatsappLinkSessions.expiresAt,
        forceRelink: whatsappLinkSessions.forceRelink,
        id: whatsappLinkSessions.id,
        lastError: whatsappLinkSessions.lastError,
        qrDataUrl: whatsappLinkSessions.qrDataUrl,
        status: whatsappLinkSessions.status,
        updatedAt: whatsappLinkSessions.updatedAt,
      });

    await tx
      .update(tenantIntegrations)
      .set({
        lastError: null,
        lastErrorAt: null,
        status: "linking",
        updatedAt: now,
      })
      .where(eq(tenantIntegrations.id, integration.id));

    return {
      linkSession: buildTenantWhatsAppLinkSession(linkSession),
      tenantId: authorizedTenant.tenantId,
    };
  });

  await enqueueJob({
    jobType: JOB_TYPES.whatsappLinkSession,
    payload: {
      linkSessionId: result.linkSession?.id ?? "",
      tenantId: result.tenantId,
    },
  });

  return result;
}

export async function getCurrentTenantWhatsAppLinkSession(input: {
  orgSlug: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    return null;
  }

  const db = getDb();

  return db.transaction(async (tx) => {
    const integration = await getWhatsAppIntegrationForTenant(tx, {
      tenantId: authorizedTenant.tenantId,
    });

    if (!integration) {
      return null;
    }

    const [session] = await tx
      .select({
        completedAt: whatsappLinkSessions.completedAt,
        createdAt: whatsappLinkSessions.createdAt,
        expiresAt: whatsappLinkSessions.expiresAt,
        forceRelink: whatsappLinkSessions.forceRelink,
        id: whatsappLinkSessions.id,
        lastError: whatsappLinkSessions.lastError,
        qrDataUrl: whatsappLinkSessions.qrDataUrl,
        status: whatsappLinkSessions.status,
        updatedAt: whatsappLinkSessions.updatedAt,
      })
      .from(whatsappLinkSessions)
      .where(eq(whatsappLinkSessions.tenantIntegrationId, integration.id))
      .orderBy(desc(whatsappLinkSessions.createdAt))
      .limit(1);

    return buildTenantWhatsAppLinkSession(session ?? null);
  });
}

export async function disconnectTenantWhatsApp(input: {
  orgSlug: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  const db = getDb();
  const tenantId = await db.transaction(async (tx) => {
    const integration = await getWhatsAppIntegrationForTenant(tx, {
      tenantId: authorizedTenant.tenantId,
    });

    if (!integration) {
      throw new Error("WhatsApp is not enabled for this workspace");
    }

    return authorizedTenant.tenantId;
  });

  await enqueueJob({
    jobType: JOB_TYPES.whatsappDisconnect,
    payload: {
      tenantId,
    },
  });

  return {
    disconnectQueued: true,
    tenantId,
  };
}

export async function clearCurrentTenantWhatsAppLinkSession(input: {
  orgSlug: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  const db = getDb();

  return db.transaction(async (tx) => {
    const integration = await getWhatsAppIntegrationForTenant(tx, {
      tenantId: authorizedTenant.tenantId,
    });

    if (!integration) {
      throw new Error("WhatsApp is not enabled for this workspace");
    }

    const [session] = await tx
      .select({
        id: whatsappLinkSessions.id,
        status: whatsappLinkSessions.status,
      })
      .from(whatsappLinkSessions)
      .where(eq(whatsappLinkSessions.tenantIntegrationId, integration.id))
      .orderBy(desc(whatsappLinkSessions.createdAt))
      .limit(1);

    if (!session) {
      return {
        cleared: false,
        linkSession: null,
      };
    }

    const now = new Date();

    await tx
      .update(whatsappLinkSessions)
      .set({
        completedAt: now,
        expiresAt: null,
        lastError: null,
        qrDataUrl: null,
        status: "dismissed",
        updatedAt: now,
      })
      .where(eq(whatsappLinkSessions.id, session.id));

    if (integration.status === "linking") {
      await tx
        .update(tenantIntegrations)
        .set({
          lastError: null,
          lastErrorAt: null,
          status: "ready_to_link",
          updatedAt: now,
        })
        .where(eq(tenantIntegrations.id, integration.id));
    }

    const [updatedSession] = await tx
      .select({
        completedAt: whatsappLinkSessions.completedAt,
        createdAt: whatsappLinkSessions.createdAt,
        expiresAt: whatsappLinkSessions.expiresAt,
        forceRelink: whatsappLinkSessions.forceRelink,
        id: whatsappLinkSessions.id,
        lastError: whatsappLinkSessions.lastError,
        qrDataUrl: whatsappLinkSessions.qrDataUrl,
        status: whatsappLinkSessions.status,
        updatedAt: whatsappLinkSessions.updatedAt,
      })
      .from(whatsappLinkSessions)
      .where(eq(whatsappLinkSessions.id, session.id))
      .limit(1);

    return {
      cleared: true,
      linkSession: buildTenantWhatsAppLinkSession(updatedSession ?? null),
    };
  });
}

async function getTenantWebSearchToolSurfaceForTenant(input: {
  tenantId: string;
}): Promise<TenantToolConfigSurface | null> {
  const definition = getToolDefinition(
    WEB_SEARCH_TOOL_SURFACE_KIND,
    WEB_SEARCH_TOOL_SURFACE_KEY,
  );

  if (!definition) {
    return null;
  }

  const [options, organizationSlug] = await Promise.all([
    definition.buildOptions({
      tenantId: input.tenantId,
      tx: getDb(),
    }),
    getOrganizationSlugForTenant(input.tenantId),
  ]);
  const resolved = resolveRuntimeWebSearchConfig();

  return {
    actionMeanings: definition.actionMeanings,
    agentCapabilities: definition.agentCapabilities,
    agentOperations: definition.agentOperations,
    allowedActions: listAvailableToolActions(definition, {
      enabled: resolved.enabled,
      installState: "installed",
    }),
    availability: resolved.enabled ? "available" : "blocked",
    blockingReason: resolved.reason,
    canAgentEdit: false,
    canUserEdit: false,
    config: {
      ...resolved.surfaceConfig,
      enabled: resolved.enabled,
      entryVersion: 1,
      installState: "installed",
      schemaVersion: WEB_SEARCH_TOOL_SCHEMA_VERSION,
    },
    description: WEB_SEARCH_TOOL_DESCRIPTION,
    derivedEffects: {
      managedBy: resolved.surfaceConfig.managedBy,
      reason: resolved.reason,
    },
    fieldMeanings: definition.fieldMeanings,
    id: getToolSurfaceId(
      WEB_SEARCH_TOOL_SURFACE_KIND,
      WEB_SEARCH_TOOL_SURFACE_KEY,
    ),
    key: WEB_SEARCH_TOOL_SURFACE_KEY,
    kind: WEB_SEARCH_TOOL_SURFACE_KIND,
    label: WEB_SEARCH_TOOL_LABEL,
    options,
    schema: webSearchRuntimeConfigJsonSchema,
    settingsUrl: organizationSlug
      ? `/${organizationSlug}/tools/web/search`
      : null,
    setupUrl: null,
    surfaceType: definition.surfaceType,
    uiGroup: definition.uiGroup,
    uiHints: webSearchRuntimeConfigUiHints,
  };
}

export async function updateTenantSlackChannelMembership(input: {
  action: "join" | "leave";
  channelId: string;
  orgSlug: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  return updateTenantSlackChannelMembershipForTenant({
    action: input.action,
    channelId: input.channelId,
    tenantId: authorizedTenant.tenantId,
  });
}

export async function updateTenantSlackChannelMembershipForTenant(input: {
  action: "join" | "leave";
  channelId: string;
  tenantId: string;
}) {
  const db = getDb();
  const installation = await db.transaction(async (tx) => {
    const slackInstallation = await getConnectedSlackInstallationForTenant(tx, {
      tenantId: input.tenantId,
    });

    if (!slackInstallation) {
      throw new Error(
        "Slack must be connected before Otto can join or leave channels",
      );
    }

    const runtimeConfig = await getOrCreateTenantSlackRuntimeConfigEntry(tx, {
      tenantId: input.tenantId,
    });

    return {
      channelAccessMode: runtimeConfig.config.channelAccessMode,
      slackInstallation,
    };
  });
  const botToken = await getTenantSlackBotToken(input.tenantId);

  if (!botToken) {
    throw new Error(
      "Slack bot token is unavailable, so Otto cannot update channel membership",
    );
  }

  if (input.action === "join") {
    await joinSlackChannel({
      botToken,
      channelId: input.channelId,
    });
  } else {
    await leaveSlackChannel({
      botToken,
      channelId: input.channelId,
    });
  }

  await refreshSlackDirectoryForInstallation({
    botToken,
    externalWorkspaceId: installation.slackInstallation.slackTeamId,
    tenantIntegrationId: installation.slackInstallation.tenantIntegrationId,
    workspaceDisplayName: installation.slackInstallation.slackTeamName,
  });

  let applyQueued = false;

  if (installation.channelAccessMode === "member_of_channels") {
    const applyResult = await db.transaction(async (tx) => {
      const desiredStateVersion = (
        await createNextDesiredStateVersion(tx, {
          tenantId: input.tenantId,
        })
      ).version;
      const tenantRuntime = await getTenantRuntimeState(tx, input.tenantId);

      return {
        applyQueued: tenantRuntime.isRuntimeReady,
        desiredStateVersion,
      };
    });

    if (applyResult.applyQueued) {
      await enqueueTenantConfigApply({
        desiredStateVersion: applyResult.desiredStateVersion,
        tenantId: input.tenantId,
      });
      applyQueued = true;
    }
  }

  const surface = await getTenantSlackRuntimeConfigSurfaceForTenant({
    tenantId: input.tenantId,
  });

  if (!surface) {
    throw new Error(
      "Slack runtime config surface not found after channel update",
    );
  }

  return {
    applyQueued,
    surface,
  };
}

export async function updateTenantSlackRuntimeConfig(input: {
  allowDestructiveChanges?: boolean;
  expectedEntryVersion?: number;
  orgSlug: string;
  patch: Partial<SlackRuntimeConfig>;
  summary?: string;
  userExternalId: string;
}) {
  const authorizedTenant = await getAuthorizedLatestTenantForOrganization({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  });

  if (!authorizedTenant) {
    throw new Error("Organization tenant not found");
  }

  return updateTenantSlackRuntimeConfigForTenant({
    allowDestructiveChanges: input.allowDestructiveChanges,
    createdByExternalId: input.userExternalId,
    createdByType: "user",
    expectedEntryVersion: input.expectedEntryVersion,
    patch: slackRuntimeConfigPatchSchema.parse(input.patch),
    summary: input.summary,
    tenantId: authorizedTenant.tenantId,
  });
}

export async function validateTenantSlackRuntimeConfigChangeForTenant(input: {
  createdByType: "runtime" | "system" | "user";
  patch: Partial<SlackRuntimeConfig>;
  tenantId: string;
}) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const currentConfig = await getOrCreateTenantSlackRuntimeConfigEntry(tx, {
      tenantId: input.tenantId,
    });

    if (currentConfig.installState !== "installed") {
      throw new Error(
        "Slack config must be installed before it can be updated",
      );
    }

    const nextConfig = parseSlackRuntimeConfig({
      ...currentConfig.config,
      ...input.patch,
    });

    await validateSlackRuntimeConfigSemantics(tx, {
      config: nextConfig,
      tenantId: input.tenantId,
    });
    const effects = await evaluateSlackPolicyForTenant(tx, {
      config: nextConfig,
      currentConfig: currentConfig.config,
      tenantId: input.tenantId,
    });

    if (
      input.createdByType === "runtime" &&
      isSlackPolicyDestructive(effects)
    ) {
      throw new Error(
        "Runtime-authored Slack policy changes cannot disable direct messages or channel replies. Use a non-destructive Slack policy action instead.",
      );
    }

    const surface = await getTenantSlackRuntimeConfigSurfaceForTenant({
      tenantId: input.tenantId,
    });

    return {
      effects,
      nextConfig,
      surface,
      validation: {
        ok: true,
        warnings: effects.warnings,
      },
    };
  });
}

export async function validateTenantWhatsAppRuntimeConfigChangeForTenant(input: {
  createdByType: "runtime" | "system" | "user";
  patch: Partial<WhatsAppRuntimeConfig>;
  tenantId: string;
}) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const integration = await getWhatsAppIntegrationForTenant(tx, {
      tenantId: input.tenantId,
    });

    if (!integration) {
      throw new Error(
        "WhatsApp must be enabled before its runtime config can be updated",
      );
    }

    const currentConfig = await getOrCreateTenantWhatsAppRuntimeConfigEntry(
      tx,
      {
        tenantId: input.tenantId,
      },
    );

    if (currentConfig.installState !== "installed") {
      throw new Error(
        "WhatsApp config must be installed before it can be updated",
      );
    }

    const nextConfig = parseWhatsAppRuntimeConfig({
      ...currentConfig.config,
      ...input.patch,
    });
    const effects = deriveWhatsAppPolicyEffects({
      config: nextConfig,
      currentConfig: currentConfig.config,
    });
    const surface = await getTenantWhatsAppRuntimeConfigSurfaceForTenant({
      tenantId: input.tenantId,
    });

    return {
      effects,
      nextConfig,
      surface,
      validation: {
        ok: true,
        warnings: effects.warnings,
      },
    };
  });
}

export async function validateTenantSlackPolicyActionForTenant(input: {
  action: SlackPolicyAction;
  createdByType: "runtime" | "system" | "user";
  tenantId: string;
}) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const currentConfig = await getOrCreateTenantSlackRuntimeConfigEntry(tx, {
      tenantId: input.tenantId,
    });

    if (currentConfig.installState !== "installed") {
      throw new Error(
        "Slack config must be installed before it can be updated",
      );
    }

    const nextConfig = applySlackPolicyAction(
      currentConfig.config,
      input.action,
    );

    await validateSlackRuntimeConfigSemantics(tx, {
      config: nextConfig,
      tenantId: input.tenantId,
    });

    const effects = await evaluateSlackPolicyForTenant(tx, {
      config: nextConfig,
      currentConfig: currentConfig.config,
      tenantId: input.tenantId,
    });

    if (
      input.createdByType === "runtime" &&
      isSlackPolicyDestructive(effects)
    ) {
      throw new Error(
        "Runtime-authored Slack policy changes cannot disable direct messages or channel replies. Use a non-destructive Slack policy action instead.",
      );
    }

    const surface = await getTenantSlackRuntimeConfigSurfaceForTenant({
      tenantId: input.tenantId,
    });

    return {
      action: input.action,
      effects,
      nextConfig,
      surface,
      validation: {
        ok: true,
        warnings: effects.warnings,
      },
    };
  });
}

export async function applyTenantSlackPolicyActionForTenant(input: {
  action: SlackPolicyAction;
  createdByExternalId?: string | null;
  createdByType: "runtime" | "system" | "user";
  expectedEntryVersion?: number;
  summary?: string;
  tenantId: string;
}) {
  const validation = await validateTenantSlackPolicyActionForTenant({
    action: input.action,
    createdByType: input.createdByType,
    tenantId: input.tenantId,
  });

  const result = await updateTenantSlackRuntimeConfigForTenant({
    allowDestructiveChanges: false,
    createdByExternalId: input.createdByExternalId,
    createdByType: input.createdByType,
    expectedEntryVersion: input.expectedEntryVersion,
    patch: validation.nextConfig,
    summary:
      input.summary ??
      `Applied Slack policy action: ${input.action.type.replaceAll("_", " ")}`,
    tenantId: input.tenantId,
  });
  const surface = await getTenantSlackRuntimeConfigSurfaceForTenant({
    tenantId: input.tenantId,
  });

  return {
    ...result,
    action: input.action,
    surface,
    validation: {
      ok: true,
      warnings: validation.effects.warnings,
    },
  };
}

export async function updateTenantManagedFileSharedContentForTenant(input: {
  createdByExternalId?: string | null;
  createdByType: "runtime" | "user";
  expectedVersion?: number;
  filePath: ManagedBootstrapFilePath;
  sharedContent: string;
  summary?: string;
  tenantId: string;
}) {
  const db = getDb();
  const normalizedSharedContent = input.sharedContent.trim();

  if (!normalizedSharedContent) {
    throw new Error("Shared managed content cannot be empty");
  }

  const result = await db.transaction(async (tx) => {
    const latestConfig = await ensureLatestTenantManagedConfigVersion(tx, {
      tenantId: input.tenantId,
    });

    if (
      input.expectedVersion !== undefined &&
      latestConfig.version !== input.expectedVersion
    ) {
      throw new ManagedConfigVersionConflictError(
        input.expectedVersion,
        latestConfig.version,
      );
    }

    const latestFiles = await tx
      .select({
        path: tenantManagedFileVersions.path,
        sharedContent: tenantManagedFileVersions.sharedContent,
        systemContent: tenantManagedFileVersions.systemContent,
      })
      .from(tenantManagedFileVersions)
      .where(
        eq(
          tenantManagedFileVersions.tenantManagedConfigVersionId,
          latestConfig.id,
        ),
      );

    const completeLatestFiles = getManagedBootstrapFileDefinitions().map(
      (definition) => {
        const existingFile = latestFiles.find(
          (file) => file.path === definition.path,
        );

        return {
          path: definition.path,
          sharedContent:
            existingFile?.sharedContent ?? definition.defaultSharedContent,
          systemContent: definition.systemContent,
        };
      },
    );

    const targetFile = completeLatestFiles.find(
      (file) => file.path === input.filePath,
    );

    if (!targetFile) {
      throw new Error(`Managed file ${input.filePath} is missing`);
    }

    if (targetFile.sharedContent === normalizedSharedContent) {
      return {
        applyQueued: false,
        changed: false,
        currentVersion: latestConfig.version,
      };
    }

    const [createdVersion] = await tx
      .insert(tenantManagedConfigVersions)
      .values({
        createdByExternalId: input.createdByExternalId ?? null,
        createdByType: input.createdByType,
        summary: input.summary ?? `Updated ${input.filePath}`,
        tenantId: input.tenantId,
        version: latestConfig.version + 1,
      })
      .returning({
        id: tenantManagedConfigVersions.id,
        version: tenantManagedConfigVersions.version,
      });

    await tx.insert(tenantManagedFileVersions).values(
      completeLatestFiles.map((file) => {
        const sharedContent =
          file.path === input.filePath
            ? normalizedSharedContent
            : file.sharedContent;

        return {
          checksum: createManagedFileChecksum({
            path: assertManagedBootstrapFilePath(file.path),
            sharedContent,
            systemContent: file.systemContent,
          }),
          path: file.path,
          sharedContent,
          systemContent: file.systemContent,
          tenantManagedConfigVersionId: createdVersion.id,
        };
      }),
    );

    const desiredStateVersion = (
      await createNextDesiredStateVersion(tx, {
        tenantId: input.tenantId,
      })
    ).version;
    const tenantRuntime = await getTenantRuntimeState(tx, input.tenantId);

    return {
      applyQueued: tenantRuntime.isRuntimeReady,
      changed: true,
      currentVersion: createdVersion.version,
      desiredStateVersion,
      managedConfigVersion: createdVersion.version,
    };
  });

  if (!result.changed) {
    return result;
  }

  if (result.applyQueued && result.desiredStateVersion) {
    await enqueueTenantConfigApply({
      desiredStateVersion: result.desiredStateVersion,
      tenantId: input.tenantId,
    });
  }

  return result;
}

export async function updateTenantSlackRuntimeConfigForTenant(input: {
  allowDestructiveChanges?: boolean;
  createdByExternalId?: string | null;
  createdByType: "runtime" | "system" | "user";
  expectedEntryVersion?: number;
  patch: Partial<SlackRuntimeConfig>;
  summary?: string;
  tenantId: string;
}) {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const slackIntegration = await getConnectedSlackIntegrationForTenant(tx, {
      tenantId: input.tenantId,
    });

    if (!slackIntegration) {
      throw new Error(
        "Slack must be connected before its runtime config can be updated",
      );
    }

    const currentConfig = await getOrCreateTenantSlackRuntimeConfigEntry(tx, {
      tenantId: input.tenantId,
    });

    if (currentConfig.installState !== "installed") {
      throw new Error(
        "Slack config must be installed before it can be updated",
      );
    }

    if (
      typeof input.expectedEntryVersion === "number" &&
      currentConfig.entryVersion !== input.expectedEntryVersion
    ) {
      throw new TenantRuntimeConfigVersionConflictError(
        input.expectedEntryVersion,
        currentConfig.entryVersion,
      );
    }

    const nextConfig = parseSlackRuntimeConfig({
      ...currentConfig.config,
      ...input.patch,
    });

    await validateSlackRuntimeConfigSemantics(tx, {
      config: nextConfig,
      tenantId: input.tenantId,
    });
    const effects = await evaluateSlackPolicyForTenant(tx, {
      config: nextConfig,
      currentConfig: currentConfig.config,
      tenantId: input.tenantId,
    });

    if (
      input.createdByType === "runtime" &&
      isSlackPolicyDestructive(effects)
    ) {
      throw new Error(
        "Runtime-authored Slack policy changes cannot disable direct messages or channel replies. Use a non-destructive Slack policy action instead.",
      );
    }

    if (
      input.createdByType === "user" &&
      isSlackPolicyDestructive(effects) &&
      !input.allowDestructiveChanges
    ) {
      throw new Error(
        "This Slack settings change would disable direct messages or channel replies. Confirm the destructive change in the dashboard before saving it.",
      );
    }

    if (JSON.stringify(currentConfig.config) === JSON.stringify(nextConfig)) {
      return {
        applyQueued: false,
        changed: false,
        currentEntryVersion: currentConfig.entryVersion,
      };
    }

    const now = new Date();
    const nextEntryVersion = currentConfig.entryVersion + 1;

    await tx
      .update(tenantRuntimeConfigEntries)
      .set({
        changeSummary: input.summary ?? "Updated Slack runtime config",
        configJson: nextConfig,
        entryVersion: nextEntryVersion,
        installState: "installed",
        lastValidatedAt: now,
        lastValidationError: null,
        schemaVersion: SLACK_RUNTIME_CONFIG_SCHEMA_VERSION,
        updatedAt: now,
        updatedByExternalId: input.createdByExternalId ?? null,
        updatedByType: input.createdByType,
      })
      .where(eq(tenantRuntimeConfigEntries.id, currentConfig.id));

    const desiredStateVersion = (
      await createNextDesiredStateVersion(tx, {
        tenantId: input.tenantId,
      })
    ).version;
    const tenantRuntime = await getTenantRuntimeState(tx, input.tenantId);

    await tx.insert(tenantRuntimeConfigMutations).values({
      actorExternalId: input.createdByExternalId ?? null,
      actorType: input.createdByType,
      desiredStateVersion,
      expectedEntryVersion: input.expectedEntryVersion ?? null,
      mutationType: "update",
      patchJson: input.patch,
      resultJson: nextConfig,
      resultingEntryVersion: nextEntryVersion,
      tenantId: input.tenantId,
      tenantRuntimeConfigEntryId: currentConfig.id,
    });

    return {
      applyQueued: tenantRuntime.isRuntimeReady,
      changed: true,
      currentEntryVersion: nextEntryVersion,
      desiredStateVersion,
      effects,
      installState: "installed" as const,
    };
  });

  if (result.applyQueued && result.desiredStateVersion) {
    await enqueueTenantConfigApply({
      desiredStateVersion: result.desiredStateVersion,
      tenantId: input.tenantId,
    });
  }

  return result;
}

export async function updateTenantWhatsAppRuntimeConfigForTenant(input: {
  allowDestructiveChanges?: boolean;
  createdByExternalId?: string | null;
  createdByType: "runtime" | "system" | "user";
  expectedEntryVersion?: number;
  patch: Partial<WhatsAppRuntimeConfig>;
  summary?: string;
  tenantId: string;
}) {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const integration = await getWhatsAppIntegrationForTenant(tx, {
      tenantId: input.tenantId,
    });

    if (!integration) {
      throw new Error(
        "WhatsApp must be enabled before its runtime config can be updated",
      );
    }

    const currentConfig = await getOrCreateTenantWhatsAppRuntimeConfigEntry(
      tx,
      {
        tenantId: input.tenantId,
      },
    );

    if (currentConfig.installState !== "installed") {
      throw new Error(
        "WhatsApp config must be installed before it can be updated",
      );
    }

    if (
      typeof input.expectedEntryVersion === "number" &&
      currentConfig.entryVersion !== input.expectedEntryVersion
    ) {
      throw new TenantRuntimeConfigVersionConflictError(
        input.expectedEntryVersion,
        currentConfig.entryVersion,
      );
    }

    const nextConfig = parseWhatsAppRuntimeConfig({
      ...currentConfig.config,
      ...input.patch,
    });
    const effects = deriveWhatsAppPolicyEffects({
      config: nextConfig,
      currentConfig: currentConfig.config,
    });

    if (
      input.createdByType === "user" &&
      effects.wouldFullyLockOutWhatsApp &&
      !input.allowDestructiveChanges
    ) {
      throw new Error(
        "This WhatsApp settings change would fully lock Otto out of WhatsApp. Confirm the destructive change in the workspace before saving it.",
      );
    }

    if (JSON.stringify(currentConfig.config) === JSON.stringify(nextConfig)) {
      return {
        applyQueued: false,
        changed: false,
        currentEntryVersion: currentConfig.entryVersion,
      };
    }

    const now = new Date();
    const nextEntryVersion = currentConfig.entryVersion + 1;

    await tx
      .update(tenantRuntimeConfigEntries)
      .set({
        changeSummary: input.summary ?? "Updated WhatsApp runtime config",
        configJson: nextConfig,
        entryVersion: nextEntryVersion,
        installState: "installed",
        lastValidatedAt: now,
        lastValidationError: null,
        schemaVersion: WHATSAPP_RUNTIME_CONFIG_SCHEMA_VERSION,
        updatedAt: now,
        updatedByExternalId: input.createdByExternalId ?? null,
        updatedByType: input.createdByType,
      })
      .where(eq(tenantRuntimeConfigEntries.id, currentConfig.id));

    const desiredStateVersion = (
      await createNextDesiredStateVersion(tx, {
        tenantId: input.tenantId,
      })
    ).version;
    const tenantRuntime = await getTenantRuntimeState(tx, input.tenantId);

    await tx.insert(tenantRuntimeConfigMutations).values({
      actorExternalId: input.createdByExternalId ?? null,
      actorType: input.createdByType,
      desiredStateVersion,
      expectedEntryVersion: input.expectedEntryVersion ?? null,
      mutationType: "update",
      patchJson: input.patch,
      resultJson: nextConfig,
      resultingEntryVersion: nextEntryVersion,
      tenantId: input.tenantId,
      tenantRuntimeConfigEntryId: currentConfig.id,
    });

    return {
      applyQueued: tenantRuntime.isRuntimeReady,
      changed: true,
      currentEntryVersion: nextEntryVersion,
      desiredStateVersion,
      effects,
      installState: "installed" as const,
    };
  });

  if (result.applyQueued && result.desiredStateVersion) {
    await enqueueTenantConfigApply({
      desiredStateVersion: result.desiredStateVersion,
      tenantId: input.tenantId,
    });
  }

  return result;
}

export async function setTenantToolInstallStateForTenant(input: {
  createdByExternalId?: string | null;
  createdByType: "runtime" | "system" | "user";
  enabled?: boolean;
  expectedEntryVersion?: number;
  installState: ToolInstallState;
  summary?: string;
  surfaceKey: string;
  surfaceKind: string;
  tenantId: string;
}) {
  const definition = getToolDefinition(input.surfaceKind, input.surfaceKey);

  if (!definition) {
    throw new Error("Unsupported tool config surface");
  }

  const mutationError = getSurfaceLifecycleMutationError(definition);

  if (mutationError) {
    throw new Error(mutationError);
  }

  if (!isSlackSurface(input.surfaceKind, input.surfaceKey)) {
    throw new Error("Unsupported tool config surface");
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const currentConfig = await getOrCreateTenantSlackRuntimeConfigEntry(tx, {
      tenantId: input.tenantId,
    });

    if (
      typeof input.expectedEntryVersion === "number" &&
      currentConfig.entryVersion !== input.expectedEntryVersion
    ) {
      throw new TenantRuntimeConfigVersionConflictError(
        input.expectedEntryVersion,
        currentConfig.entryVersion,
      );
    }

    if (input.installState === "installed") {
      const slackIntegration = await getConnectedSlackIntegrationForTenant(tx, {
        tenantId: input.tenantId,
      });

      if (!slackIntegration) {
        throw new Error(
          "Slack must be connected before its runtime surface can be installed",
        );
      }
    }

    if (
      input.installState === "uninstalled" &&
      typeof input.enabled === "boolean" &&
      input.enabled
    ) {
      throw new Error("An uninstalled runtime surface cannot be enabled");
    }

    const nextEnabled =
      input.installState === "uninstalled"
        ? false
        : typeof input.enabled === "boolean"
          ? input.enabled
          : currentConfig.installState === "uninstalled"
            ? true
            : currentConfig.enabled;

    if (
      currentConfig.installState === input.installState &&
      currentConfig.enabled === nextEnabled
    ) {
      const surface = await getTenantToolConfigSurfaceForTenant({
        surfaceKey: input.surfaceKey,
        surfaceKind: input.surfaceKind,
        tenantId: input.tenantId,
      });

      return {
        applyQueued: false,
        changed: false,
        currentEntryVersion: currentConfig.entryVersion,
        desiredStateVersion: undefined,
        surface,
      };
    }

    const now = new Date();
    const nextEntryVersion = currentConfig.entryVersion + 1;
    const mutationType =
      currentConfig.installState !== input.installState
        ? input.installState === "installed"
          ? "install"
          : "uninstall"
        : nextEnabled
          ? "enable"
          : "disable";

    await tx
      .update(tenantRuntimeConfigEntries)
      .set({
        changeSummary:
          input.summary ??
          (mutationType === "install"
            ? "Installed runtime surface"
            : mutationType === "uninstall"
              ? "Uninstalled runtime surface"
              : mutationType === "enable"
                ? "Enabled runtime surface"
                : "Disabled runtime surface"),
        enabled: nextEnabled,
        entryVersion: nextEntryVersion,
        installState: input.installState,
        lastValidatedAt: now,
        lastValidationError: null,
        updatedAt: now,
        updatedByExternalId: input.createdByExternalId ?? null,
        updatedByType: input.createdByType,
      })
      .where(eq(tenantRuntimeConfigEntries.id, currentConfig.id));

    const desiredStateVersion = (
      await createNextDesiredStateVersion(tx, {
        tenantId: input.tenantId,
      })
    ).version;
    const tenantRuntime = await getTenantRuntimeState(tx, input.tenantId);

    await tx.insert(tenantRuntimeConfigMutations).values({
      actorExternalId: input.createdByExternalId ?? null,
      actorType: input.createdByType,
      desiredStateVersion,
      expectedEntryVersion: input.expectedEntryVersion ?? null,
      mutationType,
      resultJson: {
        enabled: nextEnabled,
        installState: input.installState,
      },
      resultingEntryVersion: nextEntryVersion,
      tenantId: input.tenantId,
      tenantRuntimeConfigEntryId: currentConfig.id,
    });

    const surface = await getTenantToolConfigSurfaceForTenant({
      surfaceKey: input.surfaceKey,
      surfaceKind: input.surfaceKind,
      tenantId: input.tenantId,
    });

    return {
      applyQueued: tenantRuntime.isRuntimeReady,
      changed: true,
      currentEntryVersion: nextEntryVersion,
      desiredStateVersion,
      surface,
    };
  });

  if (result.applyQueued && result.desiredStateVersion) {
    await enqueueTenantConfigApply({
      desiredStateVersion: result.desiredStateVersion,
      tenantId: input.tenantId,
    });
  }

  return result;
}

export async function reapplyTenantToolSurfaceForTenant(input: {
  createdByExternalId?: string | null;
  createdByType: "runtime" | "system" | "user";
  summary?: string;
  surfaceKey: string;
  surfaceKind: string;
  tenantId: string;
}) {
  const definition = getToolDefinition(input.surfaceKind, input.surfaceKey);

  if (!definition) {
    throw new Error("Unsupported tool config surface");
  }

  const mutationError = getSurfaceReapplyError(definition);

  if (mutationError) {
    throw new Error(mutationError);
  }

  if (isWhatsAppSurface(input.surfaceKind, input.surfaceKey)) {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const integration = await getWhatsAppIntegrationForTenant(tx, {
        tenantId: input.tenantId,
      });

      if (!integration) {
        throw new Error(
          "WhatsApp must be enabled before its runtime surface can be reapplied",
        );
      }

      const currentConfig = await getOrCreateTenantWhatsAppRuntimeConfigEntry(
        tx,
        {
          tenantId: input.tenantId,
        },
      );

      if (currentConfig.installState !== "installed") {
        throw new Error(
          "Tool surface must be installed before it can be reapplied",
        );
      }

      const desiredStateVersion = (
        await createNextDesiredStateVersion(tx, {
          tenantId: input.tenantId,
        })
      ).version;
      const tenantRuntime = await getTenantRuntimeState(tx, input.tenantId);

      await tx.insert(tenantRuntimeConfigMutations).values({
        actorExternalId: input.createdByExternalId ?? null,
        actorType: input.createdByType,
        desiredStateVersion,
        mutationType: "reapply",
        resultJson: {
          summary: input.summary ?? "Reapplied runtime surface",
        },
        resultingEntryVersion: currentConfig.entryVersion,
        tenantId: input.tenantId,
        tenantRuntimeConfigEntryId: currentConfig.id,
      });

      const surface = await getTenantToolConfigSurfaceForTenant({
        surfaceKey: input.surfaceKey,
        surfaceKind: input.surfaceKind,
        tenantId: input.tenantId,
      });

      return {
        applyQueued: tenantRuntime.isRuntimeReady,
        changed: true,
        currentEntryVersion: currentConfig.entryVersion,
        desiredStateVersion,
        surface,
      };
    });

    if (result.applyQueued && result.desiredStateVersion) {
      await enqueueTenantConfigApply({
        desiredStateVersion: result.desiredStateVersion,
        tenantId: input.tenantId,
      });
    }

    return result;
  }

  if (!isSlackSurface(input.surfaceKind, input.surfaceKey)) {
    throw new Error("Unsupported tool config surface");
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const currentConfig = await getOrCreateTenantSlackRuntimeConfigEntry(tx, {
      tenantId: input.tenantId,
    });

    if (currentConfig.installState !== "installed") {
      throw new Error(
        "Tool surface must be installed before it can be reapplied",
      );
    }

    const desiredStateVersion = (
      await createNextDesiredStateVersion(tx, {
        tenantId: input.tenantId,
      })
    ).version;
    const tenantRuntime = await getTenantRuntimeState(tx, input.tenantId);

    await tx.insert(tenantRuntimeConfigMutations).values({
      actorExternalId: input.createdByExternalId ?? null,
      actorType: input.createdByType,
      desiredStateVersion,
      mutationType: "reapply",
      resultJson: {
        summary: input.summary ?? "Reapplied runtime surface",
      },
      resultingEntryVersion: currentConfig.entryVersion,
      tenantId: input.tenantId,
      tenantRuntimeConfigEntryId: currentConfig.id,
    });

    const surface = await getTenantToolConfigSurfaceForTenant({
      surfaceKey: input.surfaceKey,
      surfaceKind: input.surfaceKind,
      tenantId: input.tenantId,
    });

    return {
      applyQueued: tenantRuntime.isRuntimeReady,
      changed: true,
      currentEntryVersion: currentConfig.entryVersion,
      desiredStateVersion,
      surface,
    };
  });

  if (result.applyQueued && result.desiredStateVersion) {
    await enqueueTenantConfigApply({
      desiredStateVersion: result.desiredStateVersion,
      tenantId: input.tenantId,
    });
  }

  return result;
}

export async function getTenantRuntimeGatewayToken(tenantId: string) {
  const db = getDb();
  const [secret] = await db
    .select({
      ciphertext: tenantRuntimeSecrets.ciphertext,
    })
    .from(tenantRuntimeSecrets)
    .where(
      and(
        eq(tenantRuntimeSecrets.tenantId, tenantId),
        eq(tenantRuntimeSecrets.secretType, OPENCLAW_GATEWAY_TOKEN_SECRET_TYPE),
      ),
    )
    .limit(1);

  if (!secret?.ciphertext) {
    return null;
  }

  return decryptControlPlaneSecret(secret.ciphertext);
}

export async function ensureTenantRuntimeGatewayToken(tenantId: string) {
  const existingToken = await getTenantRuntimeGatewayToken(tenantId);

  if (existingToken) {
    return existingToken;
  }

  const gatewayToken = buildGatewayToken();
  await storeTenantRuntimeGatewayToken({
    gatewayToken,
    tenantId,
  });

  return gatewayToken;
}

export async function storeTenantRuntimeGatewayToken(input: {
  gatewayToken: string;
  tenantId: string;
}) {
  const db = getDb();
  const now = new Date();
  const ciphertext = encryptControlPlaneSecret(input.gatewayToken);

  const [existingSecret] = await db
    .select({
      id: tenantRuntimeSecrets.id,
    })
    .from(tenantRuntimeSecrets)
    .where(
      and(
        eq(tenantRuntimeSecrets.tenantId, input.tenantId),
        eq(tenantRuntimeSecrets.secretType, OPENCLAW_GATEWAY_TOKEN_SECRET_TYPE),
      ),
    )
    .limit(1);

  if (existingSecret) {
    await db
      .update(tenantRuntimeSecrets)
      .set({
        ciphertext,
        rotatedAt: now,
      })
      .where(eq(tenantRuntimeSecrets.id, existingSecret.id));

    return;
  }

  await db.insert(tenantRuntimeSecrets).values({
    ciphertext,
    secretType: OPENCLAW_GATEWAY_TOKEN_SECRET_TYPE,
    tenantId: input.tenantId,
  });
}

export async function getTenantByRuntimeGatewayToken(gatewayToken: string) {
  const db = getDb();
  const runtimeSecrets = await db
    .select({
      ciphertext: tenantRuntimeSecrets.ciphertext,
      tenantId: tenantRuntimeSecrets.tenantId,
    })
    .from(tenantRuntimeSecrets)
    .where(
      eq(tenantRuntimeSecrets.secretType, OPENCLAW_GATEWAY_TOKEN_SECRET_TYPE),
    );

  for (const secret of runtimeSecrets) {
    const storedToken = decryptControlPlaneSecret(secret.ciphertext);

    if (tokensMatch(storedToken, gatewayToken)) {
      return {
        tenantId: secret.tenantId,
      };
    }
  }

  return null;
}

export async function enqueueTenantConfigApply(input: {
  desiredStateVersion: number;
  tenantId: string;
}) {
  const db = getDb();
  const jobId = await enqueueJob({
    jobType: JOB_TYPES.applyTenantConfig,
    payload: {
      desiredStateVersion: input.desiredStateVersion,
      tenantId: input.tenantId,
    },
  });

  await db.insert(tenantApplyRuns).values({
    desiredStateVersion: input.desiredStateVersion,
    jobRunId: jobId,
    status: "queued",
    tenantId: input.tenantId,
  });

  return jobId;
}

async function upsertMessagingWorkspace(
  tx: DbTransaction,
  input: {
    externalWorkspaceId: string;
    now: Date;
    tenantIntegrationId: string;
    workspaceDisplayName: string | null;
  },
) {
  const [existingWorkspace] = await tx
    .select({
      id: messagingWorkspaces.id,
    })
    .from(messagingWorkspaces)
    .where(
      eq(messagingWorkspaces.tenantIntegrationId, input.tenantIntegrationId),
    )
    .limit(1);

  if (existingWorkspace) {
    await tx
      .update(messagingWorkspaces)
      .set({
        displayName: input.workspaceDisplayName,
        externalWorkspaceId: input.externalWorkspaceId,
        updatedAt: input.now,
      })
      .where(eq(messagingWorkspaces.id, existingWorkspace.id));

    return existingWorkspace.id;
  }

  const [workspace] = await tx
    .insert(messagingWorkspaces)
    .values({
      displayName: input.workspaceDisplayName,
      externalWorkspaceId: input.externalWorkspaceId,
      syncStatus: "pending",
      tenantIntegrationId: input.tenantIntegrationId,
    })
    .returning({
      id: messagingWorkspaces.id,
    });

  return workspace.id;
}

async function upsertSlackIntegrationForTenant(
  tx: DbTransaction,
  input: {
    botToken: string;
    installerUserId: string | null;
    now: Date;
    scopeCsv: string;
    slackBotUserId: string | null;
    slackTeamId: string;
    slackTeamName: string | null;
    tenantId: string;
  },
) {
  const [existingIntegration] = await tx
    .select({
      id: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1);

  let tenantIntegrationId = existingIntegration?.id ?? null;

  if (tenantIntegrationId) {
    await tx
      .update(tenantIntegrations)
      .set({
        connectedAt: input.now,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: "connected",
        updatedAt: input.now,
      })
      .where(eq(tenantIntegrations.id, tenantIntegrationId));
  } else {
    const [createdIntegration] = await tx
      .insert(tenantIntegrations)
      .values({
        connectedAt: input.now,
        providerKey: SLACK_PROVIDER_KEY,
        status: "connected",
        tenantId: input.tenantId,
      })
      .returning({
        id: tenantIntegrations.id,
      });

    tenantIntegrationId = createdIntegration.id;
  }

  const [existingInstallation] = await tx
    .select({
      id: slackInstallations.id,
    })
    .from(slackInstallations)
    .where(eq(slackInstallations.tenantIntegrationId, tenantIntegrationId))
    .limit(1);

  if (existingInstallation) {
    await tx
      .update(slackInstallations)
      .set({
        installerUserId: input.installerUserId,
        installedAt: input.now,
        scopeCsv: input.scopeCsv,
        slackBotUserId: input.slackBotUserId,
        slackTeamId: input.slackTeamId,
        slackTeamName: input.slackTeamName,
        updatedAt: input.now,
      })
      .where(eq(slackInstallations.id, existingInstallation.id));
  } else {
    await tx.insert(slackInstallations).values({
      installedAt: input.now,
      installerUserId: input.installerUserId,
      scopeCsv: input.scopeCsv,
      slackBotUserId: input.slackBotUserId,
      slackTeamId: input.slackTeamId,
      slackTeamName: input.slackTeamName,
      tenantIntegrationId,
    });
  }

  const [existingSecret] = await tx
    .select({
      id: integrationSecrets.id,
    })
    .from(integrationSecrets)
    .where(
      and(
        eq(integrationSecrets.tenantIntegrationId, tenantIntegrationId),
        eq(integrationSecrets.secretType, SLACK_BOT_TOKEN_SECRET_TYPE),
      ),
    )
    .limit(1);

  if (existingSecret) {
    await tx
      .update(integrationSecrets)
      .set({
        ciphertext: encryptControlPlaneSecret(input.botToken),
        rotatedAt: input.now,
      })
      .where(eq(integrationSecrets.id, existingSecret.id));
    return tenantIntegrationId;
  }

  await tx.insert(integrationSecrets).values({
    ciphertext: encryptControlPlaneSecret(input.botToken),
    secretType: SLACK_BOT_TOKEN_SECRET_TYPE,
    tenantIntegrationId,
  });

  return tenantIntegrationId;
}

async function upsertWhatsAppIntegrationForTenant(
  tx: DbTransaction,
  input: {
    now: Date;
    statusWhenNotConnected?: string;
    tenantId: string;
  },
) {
  const [existingIntegration] = await tx
    .select({
      id: tenantIntegrations.id,
      status: tenantIntegrations.status,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, WHATSAPP_PROVIDER_KEY),
      ),
    )
    .limit(1);

  if (existingIntegration) {
    await tx
      .update(tenantIntegrations)
      .set({
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status:
          existingIntegration.status === "connected"
            ? "connected"
            : (input.statusWhenNotConnected ?? "pending_apply"),
        updatedAt: input.now,
      })
      .where(eq(tenantIntegrations.id, existingIntegration.id));

    return existingIntegration.id;
  }

  const [createdIntegration] = await tx
    .insert(tenantIntegrations)
    .values({
      providerKey: WHATSAPP_PROVIDER_KEY,
      status: input.statusWhenNotConnected ?? "pending_apply",
      tenantId: input.tenantId,
    })
    .returning({
      id: tenantIntegrations.id,
    });

  return createdIntegration.id;
}

async function recordSlackIntegrationError(
  tx: DbTransaction,
  input: {
    error: string;
    now: Date;
    tenantId: string;
  },
) {
  const [existingIntegration] = await tx
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      id: tenantIntegrations.id,
      status: tenantIntegrations.status,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1);

  if (!existingIntegration) {
    await tx.insert(tenantIntegrations).values({
      lastError: input.error,
      lastErrorAt: input.now,
      providerKey: SLACK_PROVIDER_KEY,
      status: "error",
      tenantId: input.tenantId,
    });
    return;
  }

  await tx
    .update(tenantIntegrations)
    .set({
      lastError: input.error,
      lastErrorAt: input.now,
      status: existingIntegration.connectedAt
        ? existingIntegration.status
        : "error",
      updatedAt: input.now,
    })
    .where(eq(tenantIntegrations.id, existingIntegration.id));
}

async function createNextDesiredStateVersion(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [latestDesiredState] = await tx
    .select({
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(eq(tenantDesiredStates.tenantId, input.tenantId))
    .orderBy(desc(tenantDesiredStates.version))
    .limit(1);

  const nextVersion = (latestDesiredState?.version ?? 0) + 1;
  const configJson = await compileTenantDesiredStateConfig(tx, input.tenantId);

  const [createdDesiredState] = await tx
    .insert(tenantDesiredStates)
    .values({
      configJson,
      tenantId: input.tenantId,
      version: nextVersion,
    })
    .returning({
      configJson: tenantDesiredStates.configJson,
      version: tenantDesiredStates.version,
    });

  return createdDesiredState;
}

async function compileTenantDesiredStateConfig(
  tx: DbTransaction,
  tenantId: string,
) {
  const managedConfig = await ensureLatestTenantManagedConfigVersion(tx, {
    tenantId,
  });
  const [slackIntegration, whatsAppIntegration] = await Promise.all([
    tx
      .select({
        connectedAt: tenantIntegrations.connectedAt,
        disconnectedAt: tenantIntegrations.disconnectedAt,
        installerUserId: slackInstallations.installerUserId,
        slackBotUserId: slackInstallations.slackBotUserId,
        slackTeamId: slackInstallations.slackTeamId,
        slackTeamName: slackInstallations.slackTeamName,
      })
      .from(tenantIntegrations)
      .leftJoin(
        slackInstallations,
        eq(slackInstallations.tenantIntegrationId, tenantIntegrations.id),
      )
      .where(
        and(
          eq(tenantIntegrations.tenantId, tenantId),
          eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getWhatsAppIntegrationForTenant(tx, {
      tenantId,
    }),
  ]);

  const config: Record<string, unknown> = {
    integrations: [],
    managedConfigVersion: managedConfig.version,
    media: {},
    prompts: {},
  };
  const webSearch = resolveRuntimeWebSearchConfig();

  if (webSearch.openClawConfig) {
    config.webSearch = webSearch.surfaceConfig;
  }

  if (
    slackIntegration?.connectedAt &&
    !slackIntegration.disconnectedAt &&
    slackIntegration.slackTeamId
  ) {
    const slackRuntimeConfig = await getOrCreateTenantSlackRuntimeConfigEntry(
      tx,
      {
        tenantId,
      },
    );

    if (
      slackRuntimeConfig.installState === "installed" &&
      slackRuntimeConfig.enabled
    ) {
      config.integrations = ["slack"];
      const effectiveAllowedChannelIds =
        slackRuntimeConfig.config.channelAccessMode === "member_of_channels"
          ? await getSlackMemberChannelIds(tx, {
              tenantId,
            })
          : slackRuntimeConfig.config.allowedChannelIds;

      config.slack = {
        ackReactionEnabled: slackRuntimeConfig.config.ackReactionEnabled,
        allowedChannelIds: effectiveAllowedChannelIds,
        allowedUserIds: slackRuntimeConfig.config.allowedUserIds,
        answerInThreads: slackRuntimeConfig.config.answerInThreads,
        channelAccessMode: slackRuntimeConfig.config.channelAccessMode,
        installerUserId: slackIntegration.installerUserId,
        requireMentionInChannels:
          slackRuntimeConfig.config.requireMentionInChannels,
        slackBotUserId: slackIntegration.slackBotUserId,
        teamId: slackIntegration.slackTeamId,
        teamName: slackIntegration.slackTeamName,
      };
    }

    config.media = {
      audio: {
        attachmentsMode: "first",
        echoTranscript: false,
        enabled: true,
        maxBytes: 20 * 1024 * 1024,
        model: "gpt-4o-mini-transcribe",
        provider: "openai",
      },
    };
  }

  if (whatsAppIntegration) {
    const whatsAppRuntimeConfig =
      await getOrCreateTenantWhatsAppRuntimeConfigEntry(tx, {
        tenantId,
      });

    if (
      whatsAppRuntimeConfig.installState === "installed" &&
      whatsAppRuntimeConfig.enabled
    ) {
      const integrations = Array.isArray(config.integrations)
        ? [...config.integrations]
        : [];

      if (!integrations.includes("whatsapp")) {
        integrations.push("whatsapp");
      }

      config.integrations = integrations;
      config.whatsapp = {
        ackReactionEnabled: whatsAppRuntimeConfig.config.ackReactionEnabled,
        allowedGroupIds: whatsAppRuntimeConfig.config.allowedGroupIds,
        allowedNumbers: whatsAppRuntimeConfig.config.allowedNumbers,
        dmPolicy: whatsAppRuntimeConfig.config.dmPolicy,
        groupAllowedNumbers:
          whatsAppRuntimeConfig.config.groupAllowedNumbers.length > 0
            ? whatsAppRuntimeConfig.config.groupAllowedNumbers
            : whatsAppRuntimeConfig.config.allowedNumbers,
        groupPolicy: whatsAppRuntimeConfig.config.groupPolicy,
        requireMentionInGroups:
          whatsAppRuntimeConfig.config.requireMentionInGroups,
      };
    }
  }

  return config;
}

async function getOrCreateTenantSlackRuntimeConfigEntry(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [existingEntry] = await tx
    .select({
      entryVersion: tenantRuntimeConfigEntries.entryVersion,
      id: tenantRuntimeConfigEntries.id,
      configJson: tenantRuntimeConfigEntries.configJson,
      enabled: tenantRuntimeConfigEntries.enabled,
      installState: tenantRuntimeConfigEntries.installState,
      schemaVersion: tenantRuntimeConfigEntries.schemaVersion,
    })
    .from(tenantRuntimeConfigEntries)
    .where(
      and(
        eq(tenantRuntimeConfigEntries.tenantId, input.tenantId),
        eq(
          tenantRuntimeConfigEntries.surfaceKind,
          SLACK_RUNTIME_CONFIG_SURFACE_KIND,
        ),
        eq(
          tenantRuntimeConfigEntries.surfaceKey,
          SLACK_RUNTIME_CONFIG_SURFACE_KEY,
        ),
      ),
    )
    .limit(1);

  if (existingEntry) {
    return {
      config: parseSlackRuntimeConfig(existingEntry.configJson),
      entryVersion: existingEntry.entryVersion,
      enabled: existingEntry.enabled,
      id: existingEntry.id,
      installState: normalizeInstallState(existingEntry.installState),
      schemaVersion: existingEntry.schemaVersion,
    };
  }

  const now = new Date();
  const defaultConfig = getDefaultSlackRuntimeConfig();
  const [createdEntry] = await tx
    .insert(tenantRuntimeConfigEntries)
    .values({
      changeSummary: "Seeded default Slack runtime config",
      configJson: defaultConfig,
      createdByType: "system",
      enabled: true,
      installState: "installed",
      lastValidatedAt: now,
      schemaSource: SLACK_RUNTIME_CONFIG_SCHEMA_SOURCE,
      schemaVersion: SLACK_RUNTIME_CONFIG_SCHEMA_VERSION,
      surfaceKey: SLACK_RUNTIME_CONFIG_SURFACE_KEY,
      surfaceKind: SLACK_RUNTIME_CONFIG_SURFACE_KIND,
      tenantId: input.tenantId,
      updatedAt: now,
      updatedByType: "system",
    })
    .returning({
      entryVersion: tenantRuntimeConfigEntries.entryVersion,
      id: tenantRuntimeConfigEntries.id,
      configJson: tenantRuntimeConfigEntries.configJson,
      enabled: tenantRuntimeConfigEntries.enabled,
      installState: tenantRuntimeConfigEntries.installState,
      schemaVersion: tenantRuntimeConfigEntries.schemaVersion,
    });

  return {
    config: parseSlackRuntimeConfig(createdEntry.configJson),
    entryVersion: createdEntry.entryVersion,
    enabled: createdEntry.enabled,
    id: createdEntry.id,
    installState: normalizeInstallState(createdEntry.installState),
    schemaVersion: createdEntry.schemaVersion,
  };
}

async function getOrCreateTenantWhatsAppRuntimeConfigEntry(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [existingEntry] = await tx
    .select({
      entryVersion: tenantRuntimeConfigEntries.entryVersion,
      id: tenantRuntimeConfigEntries.id,
      configJson: tenantRuntimeConfigEntries.configJson,
      enabled: tenantRuntimeConfigEntries.enabled,
      installState: tenantRuntimeConfigEntries.installState,
      schemaVersion: tenantRuntimeConfigEntries.schemaVersion,
    })
    .from(tenantRuntimeConfigEntries)
    .where(
      and(
        eq(tenantRuntimeConfigEntries.tenantId, input.tenantId),
        eq(
          tenantRuntimeConfigEntries.surfaceKind,
          WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND,
        ),
        eq(
          tenantRuntimeConfigEntries.surfaceKey,
          WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY,
        ),
      ),
    )
    .limit(1);

  if (existingEntry) {
    return {
      config: parseWhatsAppRuntimeConfig(existingEntry.configJson),
      entryVersion: existingEntry.entryVersion,
      enabled: existingEntry.enabled,
      id: existingEntry.id,
      installState: normalizeInstallState(existingEntry.installState),
      schemaVersion: existingEntry.schemaVersion,
    };
  }

  const now = new Date();
  const defaultConfig = getDefaultWhatsAppRuntimeConfig();
  const [createdEntry] = await tx
    .insert(tenantRuntimeConfigEntries)
    .values({
      changeSummary: "Seeded default WhatsApp runtime config",
      configJson: defaultConfig,
      createdByType: "system",
      enabled: false,
      installState: "uninstalled",
      lastValidatedAt: now,
      schemaSource: WHATSAPP_RUNTIME_CONFIG_SCHEMA_SOURCE,
      schemaVersion: WHATSAPP_RUNTIME_CONFIG_SCHEMA_VERSION,
      surfaceKey: WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY,
      surfaceKind: WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND,
      tenantId: input.tenantId,
      updatedAt: now,
      updatedByType: "system",
    })
    .returning({
      entryVersion: tenantRuntimeConfigEntries.entryVersion,
      id: tenantRuntimeConfigEntries.id,
      configJson: tenantRuntimeConfigEntries.configJson,
      enabled: tenantRuntimeConfigEntries.enabled,
      installState: tenantRuntimeConfigEntries.installState,
      schemaVersion: tenantRuntimeConfigEntries.schemaVersion,
    });

  return {
    config: parseWhatsAppRuntimeConfig(createdEntry.configJson),
    entryVersion: createdEntry.entryVersion,
    enabled: createdEntry.enabled,
    id: createdEntry.id,
    installState: normalizeInstallState(createdEntry.installState),
    schemaVersion: createdEntry.schemaVersion,
  };
}

async function getConnectedSlackIntegrationForTenant(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [slackIntegration] = await tx
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      disconnectedAt: tenantIntegrations.disconnectedAt,
      id: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1);

  if (!slackIntegration?.connectedAt || slackIntegration.disconnectedAt) {
    return null;
  }

  return slackIntegration;
}

async function getWhatsAppIntegrationForTenant(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [integration] = await tx
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      disconnectedAt: tenantIntegrations.disconnectedAt,
      id: tenantIntegrations.id,
      lastError: tenantIntegrations.lastError,
      lastErrorAt: tenantIntegrations.lastErrorAt,
      selfE164: whatsappInstallations.selfE164,
      selfJid: whatsappInstallations.selfJid,
      status: tenantIntegrations.status,
    })
    .from(tenantIntegrations)
    .leftJoin(
      whatsappInstallations,
      eq(whatsappInstallations.tenantIntegrationId, tenantIntegrations.id),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, WHATSAPP_PROVIDER_KEY),
      ),
    )
    .limit(1);

  return integration ?? null;
}

async function getOrganizationSlugForTenant(tenantId: string) {
  const db = getDb();

  const [organization] = await db
    .select({
      slug: organizations.slug,
    })
    .from(tenants)
    .innerJoin(organizations, eq(tenants.organizationId, organizations.id))
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return organization?.slug ?? null;
}

async function getOrganizationSlugForTenantTx(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [organization] = await tx
    .select({
      slug: organizations.slug,
    })
    .from(tenants)
    .innerJoin(organizations, eq(tenants.organizationId, organizations.id))
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  return organization?.slug ?? null;
}

async function getConnectedSlackInstallationForTenant(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [slackInstallation] = await tx
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      disconnectedAt: tenantIntegrations.disconnectedAt,
      slackTeamId: slackInstallations.slackTeamId,
      slackTeamName: slackInstallations.slackTeamName,
      tenantIntegrationId: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .innerJoin(
      slackInstallations,
      eq(slackInstallations.tenantIntegrationId, tenantIntegrations.id),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1);

  if (!slackInstallation?.connectedAt || slackInstallation.disconnectedAt) {
    return null;
  }

  return slackInstallation;
}

async function refreshTenantSlackDirectoryForTenant(input: {
  tenantId: string;
}) {
  const db = getDb();
  const slackInstallation = await db.transaction(async (tx) => {
    return getConnectedSlackInstallationForTenant(tx, {
      tenantId: input.tenantId,
    });
  });

  if (!slackInstallation) {
    return {
      error: null,
      refreshed: false,
    };
  }

  const botToken = await getTenantSlackBotToken(input.tenantId);

  if (!botToken) {
    const error =
      "Slack bot token is unavailable, so the Slack directory could not be refreshed";

    await recordMessagingWorkspaceSyncFailure({
      error,
      externalWorkspaceId: slackInstallation.slackTeamId,
      tenantIntegrationId: slackInstallation.tenantIntegrationId,
      workspaceDisplayName: slackInstallation.slackTeamName,
    });

    return {
      error,
      refreshed: false,
    };
  }

  try {
    await refreshSlackDirectoryForInstallation({
      botToken,
      externalWorkspaceId: slackInstallation.slackTeamId,
      tenantIntegrationId: slackInstallation.tenantIntegrationId,
      workspaceDisplayName: slackInstallation.slackTeamName,
    });

    return {
      error: null,
      refreshed: true,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Slack refresh failure";

    await recordMessagingWorkspaceSyncFailure({
      error: message,
      externalWorkspaceId: slackInstallation.slackTeamId,
      tenantIntegrationId: slackInstallation.tenantIntegrationId,
      workspaceDisplayName: slackInstallation.slackTeamName,
    });

    return {
      error: message,
      refreshed: false,
    };
  }
}

async function refreshSlackDirectoryForInstallation(input: {
  botToken: string;
  externalWorkspaceId: string;
  tenantIntegrationId: string;
  workspaceDisplayName: string | null;
}) {
  const directory = await fetchSlackMessagingDirectory(input.botToken);

  await syncMessagingDirectoryForTenantIntegration({
    conversations: directory.conversations,
    externalWorkspaceId: input.externalWorkspaceId,
    members: directory.members,
    tenantIntegrationId: input.tenantIntegrationId,
    workspaceDisplayName: input.workspaceDisplayName,
  });
}

async function validateSlackRuntimeConfigSemantics(
  tx: DbTransaction,
  input: {
    config: SlackRuntimeConfig;
    tenantId: string;
  },
) {
  const [workspace] = await tx
    .select({
      id: messagingWorkspaces.id,
    })
    .from(messagingWorkspaces)
    .innerJoin(
      tenantIntegrations,
      eq(messagingWorkspaces.tenantIntegrationId, tenantIntegrations.id),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1);

  if (!workspace) {
    if (
      input.config.allowedChannelIds.length === 0 &&
      input.config.allowedUserIds.length === 0
    ) {
      return;
    }

    throw new Error(
      "Slack directory is unavailable, so Slack allowlists cannot be updated yet",
    );
  }

  const [members, conversations] = await Promise.all([
    tx
      .select({
        externalMemberId: messagingWorkspaceMembers.externalMemberId,
      })
      .from(messagingWorkspaceMembers)
      .where(eq(messagingWorkspaceMembers.messagingWorkspaceId, workspace.id)),
    tx
      .select({
        externalConversationId: messagingConversations.externalConversationId,
        isArchived: messagingConversations.isArchived,
      })
      .from(messagingConversations)
      .where(eq(messagingConversations.messagingWorkspaceId, workspace.id)),
  ]);

  const validUserIds = new Set(
    members.map((member) => member.externalMemberId),
  );
  const conversationsById = new Map(
    conversations.map((conversation) => [
      conversation.externalConversationId,
      conversation,
    ]),
  );

  const missingUserIds = input.config.allowedUserIds.filter(
    (userId) => !validUserIds.has(userId),
  );

  if (missingUserIds.length > 0) {
    throw new Error(
      `Unknown Slack user IDs in allowlist: ${missingUserIds.join(", ")}`,
    );
  }

  if (input.config.channelAccessMode === "member_of_channels") {
    return;
  }

  const missingChannelIds = input.config.allowedChannelIds.filter(
    (channelId) => !conversationsById.has(channelId),
  );

  if (missingChannelIds.length > 0) {
    throw new Error(
      `Unknown Slack channel IDs in allowlist: ${missingChannelIds.join(", ")}`,
    );
  }

  const archivedChannelIds = input.config.allowedChannelIds.filter(
    (channelId) => conversationsById.get(channelId)?.isArchived,
  );

  if (archivedChannelIds.length > 0) {
    throw new Error(
      `Archived Slack channels cannot be allowlisted: ${archivedChannelIds.join(", ")}`,
    );
  }
}

async function getSlackDirectoryOptions(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [workspace] = await tx
    .select({
      id: messagingWorkspaces.id,
    })
    .from(messagingWorkspaces)
    .innerJoin(
      tenantIntegrations,
      eq(messagingWorkspaces.tenantIntegrationId, tenantIntegrations.id),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1);

  if (!workspace) {
    return {
      channels: [] as SlackRuntimeConfigDirectoryOption[],
      users: [] as SlackRuntimeConfigDirectoryOption[],
    };
  }

  const [members, conversations] = await Promise.all([
    tx
      .select({
        displayName: messagingWorkspaceMembers.displayName,
        externalMemberId: messagingWorkspaceMembers.externalMemberId,
        fullName: messagingWorkspaceMembers.fullName,
        isDeleted: messagingWorkspaceMembers.isDeleted,
        username: messagingWorkspaceMembers.username,
      })
      .from(messagingWorkspaceMembers)
      .where(eq(messagingWorkspaceMembers.messagingWorkspaceId, workspace.id))
      .orderBy(
        messagingWorkspaceMembers.displayName,
        messagingWorkspaceMembers.username,
      ),
    tx
      .select({
        conversationType: messagingConversations.conversationType,
        externalConversationId: messagingConversations.externalConversationId,
        isArchived: messagingConversations.isArchived,
        metadataJson: messagingConversations.metadataJson,
        name: messagingConversations.name,
        purpose: messagingConversations.purpose,
        topic: messagingConversations.topic,
      })
      .from(messagingConversations)
      .where(eq(messagingConversations.messagingWorkspaceId, workspace.id))
      .orderBy(messagingConversations.name),
  ]);

  return {
    channels: conversations.map((conversation) => ({
      description: conversation.topic ?? conversation.purpose ?? null,
      id: conversation.externalConversationId,
      isArchived: conversation.isArchived,
      isMember: getSlackChannelMembership(conversation.metadataJson),
      label: conversation.name
        ? `#${conversation.name}`
        : conversation.externalConversationId,
      memberCount: getSlackChannelMemberCount(conversation.metadataJson),
      secondaryLabel: conversation.externalConversationId,
      visibility: getSlackChannelVisibility(conversation.conversationType),
    })),
    users: members
      .filter((member) => !member.isDeleted)
      .map((member) => ({
        description: member.fullName ?? null,
        id: member.externalMemberId,
        label:
          member.displayName ??
          member.fullName ??
          member.username ??
          member.externalMemberId,
        secondaryLabel: member.username ? `@${member.username}` : null,
      })),
  };
}

async function getSlackMemberChannelIds(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [workspace] = await tx
    .select({
      id: messagingWorkspaces.id,
    })
    .from(messagingWorkspaces)
    .innerJoin(
      tenantIntegrations,
      eq(messagingWorkspaces.tenantIntegrationId, tenantIntegrations.id),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1);

  if (!workspace) {
    return [];
  }

  const conversations = await tx
    .select({
      externalConversationId: messagingConversations.externalConversationId,
      isArchived: messagingConversations.isArchived,
      metadataJson: messagingConversations.metadataJson,
    })
    .from(messagingConversations)
    .where(eq(messagingConversations.messagingWorkspaceId, workspace.id))
    .orderBy(messagingConversations.name);

  return conversations
    .filter(
      (conversation) =>
        !conversation.isArchived &&
        getSlackChannelMembership(conversation.metadataJson),
    )
    .map((conversation) => conversation.externalConversationId);
}

function getSlackChannelVisibility(conversationType: string) {
  if (conversationType === "private_channel") {
    return "private" as const;
  }

  if (conversationType === "channel") {
    return "public" as const;
  }

  return null;
}

function getSlackChannelMemberCount(metadataJson: unknown) {
  if (!metadataJson || typeof metadataJson !== "object") {
    return null;
  }

  const numMembers = (metadataJson as { num_members?: unknown }).num_members;

  return typeof numMembers === "number" ? numMembers : null;
}

function getSlackChannelMembership(metadataJson: unknown) {
  if (!metadataJson || typeof metadataJson !== "object") {
    return false;
  }

  return Boolean((metadataJson as { is_member?: unknown }).is_member);
}

function buildTenantSlackRuntimeConfig(input: {
  config: SlackRuntimeConfig;
  enabled: boolean;
  entryVersion: number;
  installState: ToolInstallState;
  schemaVersion: string;
}): TenantSlackRuntimeConfig {
  return {
    ...input.config,
    enabled: input.enabled,
    entryVersion: input.entryVersion,
    installState: input.installState,
    schemaVersion: input.schemaVersion,
  };
}

function buildTenantWhatsAppRuntimeConfig(input: {
  config: WhatsAppRuntimeConfig;
  enabled: boolean;
  entryVersion: number;
  installState: ToolInstallState;
  schemaVersion: string;
}): TenantWhatsAppRuntimeConfig {
  return {
    ...input.config,
    enabled: input.enabled,
    entryVersion: input.entryVersion,
    installState: input.installState,
    schemaVersion: input.schemaVersion,
  };
}

function buildTenantWhatsAppLinkSession(
  session: {
    completedAt: Date | null;
    createdAt: Date;
    expiresAt: Date | null;
    forceRelink: boolean;
    id: string;
    lastError: string | null;
    qrDataUrl: string | null;
    status: string;
    updatedAt: Date;
  } | null,
): TenantWhatsAppLinkSession | null {
  if (!session) {
    return null;
  }

  return {
    completedAt: session.completedAt,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    forceRelink: session.forceRelink,
    id: session.id,
    lastError: session.lastError,
    qrDataUrl: session.qrDataUrl,
    status: session.status,
    updatedAt: session.updatedAt,
  };
}

async function ensureLatestTenantManagedConfigVersion(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [existingVersion] = await tx
    .select({
      id: tenantManagedConfigVersions.id,
      version: tenantManagedConfigVersions.version,
    })
    .from(tenantManagedConfigVersions)
    .where(eq(tenantManagedConfigVersions.tenantId, input.tenantId))
    .orderBy(desc(tenantManagedConfigVersions.version))
    .limit(1);

  if (existingVersion) {
    return existingVersion;
  }

  return createInitialTenantManagedConfigVersion(tx, {
    tenantId: input.tenantId,
  });
}

async function createInitialTenantManagedConfigVersion(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [createdVersion] = await tx
    .insert(tenantManagedConfigVersions)
    .values({
      createdByType: "system",
      summary: "Seeded initial managed bootstrap files",
      tenantId: input.tenantId,
      version: 1,
    })
    .returning({
      id: tenantManagedConfigVersions.id,
      version: tenantManagedConfigVersions.version,
    });

  await tx.insert(tenantManagedFileVersions).values(
    getManagedBootstrapFileDefinitions().map((definition) => ({
      checksum: createManagedFileChecksum({
        path: definition.path,
        sharedContent: definition.defaultSharedContent,
        systemContent: definition.systemContent,
      }),
      path: definition.path,
      sharedContent: definition.defaultSharedContent,
      systemContent: definition.systemContent,
      tenantManagedConfigVersionId: createdVersion.id,
    })),
  );

  return createdVersion;
}

async function getAuthorizedLatestTenantForOrganization(input: {
  orgSlug: string;
  userExternalId: string;
}) {
  const db = getDb();
  const [tenantRow] = await db
    .select({
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantStatus: tenants.status,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .innerJoin(tenants, eq(tenants.organizationId, organizations.id))
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(
      and(
        eq(organizations.slug, input.orgSlug),
        eq(users.externalId, input.userExternalId),
      ),
    )
    .orderBy(desc(tenants.createdAt))
    .limit(1);

  if (!tenantRow) {
    return null;
  }

  return buildTenantRuntimeState(tenantRow);
}

async function markSlackIntegrationPendingApply(
  tx: DbTransaction,
  input: {
    now: Date;
    tenantId: string;
  },
) {
  await tx
    .update(tenantIntegrations)
    .set({
      lastError: null,
      lastErrorAt: null,
      status: "pending_apply",
      updatedAt: input.now,
    })
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    );
}

async function markWhatsAppIntegrationPendingApply(
  tx: DbTransaction,
  input: {
    now: Date;
    tenantId: string;
  },
) {
  await tx
    .update(tenantIntegrations)
    .set({
      disconnectedAt: null,
      lastError: null,
      lastErrorAt: null,
      status: "pending_apply",
      updatedAt: input.now,
    })
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, WHATSAPP_PROVIDER_KEY),
      ),
    );
}

function buildGatewayToken() {
  return randomBytes(24).toString("base64url");
}

async function getTenantRuntimeState(tx: DbTransaction, tenantId: string) {
  const [tenantRow] = await tx
    .select({
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantStatus: tenants.status,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenantRow) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  return buildTenantRuntimeState(tenantRow);
}

function buildTenantRuntimeState(tenantRow: {
  serverStatus: string | null;
  tenantId: string;
  tenantStatus: string;
}) {
  return {
    isRuntimeReady:
      tenantRow.tenantStatus === "ready" && tenantRow.serverStatus === "ready",
    tenantId: tenantRow.tenantId,
  };
}

export function getManagedConfigVersionFromConfigJson(configJson: unknown) {
  const config = parseRecord(configJson);
  const managedConfigVersion = config.managedConfigVersion;

  if (
    typeof managedConfigVersion !== "number" ||
    !Number.isInteger(managedConfigVersion) ||
    managedConfigVersion < 1
  ) {
    return null;
  }

  return managedConfigVersion;
}

function createManagedFileChecksum(input: {
  path: ManagedBootstrapFilePath;
  sharedContent: string;
  systemContent: string;
}) {
  return createHash("sha256")
    .update(
      buildManagedBootstrapFileContent({
        path: input.path,
        sharedContent: input.sharedContent,
        systemContent: input.systemContent,
      }),
    )
    .digest("hex");
}

function assertManagedBootstrapFilePath(
  value: string,
): ManagedBootstrapFilePath {
  if (!isManagedBootstrapFilePath(value)) {
    throw new Error(`Unsupported managed bootstrap file path: ${value}`);
  }

  return value;
}

function tokensMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeJsonValue(value: unknown) {
  if (value === undefined) {
    return null;
  }

  return value;
}

function deriveTenantName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "tenant";
}

function normalizeOrganizationSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateOrganizationSlugFromWorkOS(
  organizationName: string,
  organizationExternalId: string,
) {
  const db = getDb();
  const baseSlug = normalizeOrganizationSlug(organizationName) || "workspace";
  const externalIdSuffix = organizationExternalId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(-8);
  const fallbackSlug = externalIdSuffix
    ? `${baseSlug}-${externalIdSuffix}`
    : `${baseSlug}-workspace`;
  const candidates = [baseSlug, fallbackSlug];

  for (const candidate of candidates) {
    const [existingOrganization] = await db
      .select({
        externalId: organizations.externalId,
      })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1);

    if (
      !existingOrganization ||
      existingOrganization.externalId === organizationExternalId
    ) {
      return candidate;
    }
  }

  for (let index = 2; ; index += 1) {
    const candidate = `${fallbackSlug}-${index}`;
    const [existingOrganization] = await db
      .select({
        externalId: organizations.externalId,
      })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1);

    if (
      !existingOrganization ||
      existingOrganization.externalId === organizationExternalId
    ) {
      return candidate;
    }
  }
}

export async function createTenantForOrganization(input: {
  organizationId: string;
  tenantName: string;
  userExternalId: string;
}) {
  const db = getDb();

  const authorizedMembership = await db
    .select({
      organizationId: memberships.organizationId,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.organizationId, input.organizationId),
        eq(users.externalId, input.userExternalId),
      ),
    );

  if (authorizedMembership.length === 0) {
    throw new Error("You do not have access to this organization");
  }

  const createdTenant = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({
        organizationId: input.organizationId,
        name: input.tenantName,
        status: "provisioning",
      })
      .returning({
        id: tenants.id,
      });

    await tx.insert(tenantServers).values({
      tenantId: tenant.id,
      provider: "hetzner",
      sshUsername: "openclaw",
      status: "creating",
    });

    await createNextDesiredStateVersion(tx, {
      tenantId: tenant.id,
    });

    return tenant;
  });

  await enqueueJob({
    jobType: JOB_TYPES.provisionTenantServer,
    payload: {
      tenantId: createdTenant.id,
      step: "create_server",
    },
  });
}

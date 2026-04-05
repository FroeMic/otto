import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalId: varchar("external_id", { length: 255 }).notNull().unique(),
  isReady: boolean("is_ready").default(false).notNull(),
  locale: varchar("locale", { length: 32 }).default("en-US").notNull(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  timeFormatPreference: varchar("time_format_preference", {
    length: 16,
  })
    .default("auto")
    .notNull(),
  timezone: varchar("timezone", { length: 128 }).default("UTC").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalId: varchar("external_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userPlatformRoles = pgTable(
  "user_platform_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("user_platform_roles_user_id_idx").on(table.userId),
    userRoleUniqueIdx: uniqueIndex("user_platform_roles_user_id_role_idx").on(
      table.userId,
      table.role,
    ),
  }),
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationIdx: index("memberships_organization_id_idx").on(
      table.organizationId,
    ),
    userIdx: index("memberships_user_id_idx").on(table.userId),
  }),
);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationIdx: index("tenants_organization_id_idx").on(
      table.organizationId,
    ),
  }),
);

export const tenantOnboardingSessions = pgTable(
  "tenant_onboarding_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    tenantName: text("tenant_name").notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    slackBotTokenCiphertext: text("slack_bot_token_ciphertext"),
    slackBotUserId: varchar("slack_bot_user_id", { length: 255 }),
    slackInstalledAt: timestamp("slack_installed_at", { withTimezone: true }),
    slackScopeCsv: text("slack_scope_csv"),
    slackTeamId: varchar("slack_team_id", { length: 255 }),
    slackTeamName: text("slack_team_name"),
    slackOauthError: text("slack_oauth_error"),
    slackOauthErrorAt: timestamp("slack_oauth_error_at", {
      withTimezone: true,
    }),
    slackConnectedAt: timestamp("slack_connected_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationIdx: index("tenant_onboarding_sessions_organization_id_idx").on(
      table.organizationId,
    ),
    tenantIdx: index("tenant_onboarding_sessions_tenant_id_idx").on(
      table.tenantId,
    ),
    userIdx: index("tenant_onboarding_sessions_user_id_idx").on(table.userId),
    statusIdx: index("tenant_onboarding_sessions_status_idx").on(table.status),
  }),
);

export const tenantIntegrations = pgTable(
  "tenant_integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    providerKey: varchar("provider_key", { length: 64 }).notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    providerStatusIdx: index("tenant_integrations_provider_status_idx").on(
      table.providerKey,
      table.status,
    ),
    tenantIdx: index("tenant_integrations_tenant_id_idx").on(table.tenantId),
    tenantProviderUniqueIdx: uniqueIndex(
      "tenant_integrations_tenant_id_provider_key_idx",
    ).on(table.tenantId, table.providerKey),
  }),
);

export const integrationSlackInstallations = pgTable(
  "integration_slack_installations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantIntegrationId: uuid("tenant_integration_id")
      .references(() => tenantIntegrations.id, { onDelete: "cascade" })
      .notNull(),
    slackTeamId: varchar("slack_team_id", { length: 255 }).notNull(),
    slackTeamName: text("slack_team_name"),
    slackBotUserId: varchar("slack_bot_user_id", { length: 255 }),
    installerUserId: varchar("installer_user_id", { length: 255 }),
    scopeCsv: text("scope_csv"),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIntegrationUniqueIdx: uniqueIndex(
      "integration_slack_installations_tenant_integration_id_idx",
    ).on(table.tenantIntegrationId),
  }),
);

export const integrationWhatsAppInstallations = pgTable(
  "integration_whatsapp_installations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantIntegrationId: uuid("tenant_integration_id")
      .references(() => tenantIntegrations.id, { onDelete: "cascade" })
      .notNull(),
    selfJid: varchar("self_jid", { length: 255 }),
    selfE164: varchar("self_e164", { length: 32 }),
    linkedAt: timestamp("linked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIntegrationUniqueIdx: uniqueIndex(
      "integration_whatsapp_installations_tenant_integration_id_idx",
    ).on(table.tenantIntegrationId),
  }),
);

export const integrationWhatsAppLinkSessions = pgTable(
  "integration_whatsapp_link_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantIntegrationId: uuid("tenant_integration_id")
      .references(() => tenantIntegrations.id, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    qrDataUrl: text("qr_data_url"),
    startedByExternalId: varchar("started_by_external_id", { length: 255 }),
    forceRelink: boolean("force_relink").default(false).notNull(),
    lastError: text("last_error"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIntegrationIdx: index(
      "integration_whatsapp_link_sessions_tenant_integration_id_idx",
    ).on(table.tenantIntegrationId),
    tenantIntegrationStatusIdx: index(
      "integration_whatsapp_link_sessions_tenant_integration_id_status_idx",
    ).on(table.tenantIntegrationId, table.status),
  }),
);

export const integrationCredentials = pgTable(
  "integration_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantIntegrationId: uuid("tenant_integration_id")
      .references(() => tenantIntegrations.id, { onDelete: "cascade" })
      .notNull(),
    secretType: varchar("secret_type", { length: 64 }).notNull(),
    ciphertext: text("ciphertext").notNull(),
    keyVersion: integer("key_version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  },
  (table) => ({
    tenantIntegrationIdx: index(
      "integration_credentials_tenant_integration_id_idx",
    ).on(table.tenantIntegrationId),
    tenantIntegrationSecretTypeUniqueIdx: uniqueIndex(
      "integration_credentials_tenant_integration_id_secret_type_idx",
    ).on(table.tenantIntegrationId, table.secretType),
  }),
);

export const integrationMessagingWorkspaces = pgTable(
  "integration_messaging_workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantIntegrationId: uuid("tenant_integration_id")
      .references(() => tenantIntegrations.id, { onDelete: "cascade" })
      .notNull(),
    externalWorkspaceId: varchar("external_workspace_id", {
      length: 255,
    }).notNull(),
    displayName: text("display_name"),
    syncStatus: varchar("sync_status", { length: 64 }).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncError: text("last_sync_error"),
    lastSyncErrorAt: timestamp("last_sync_error_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIntegrationUniqueIdx: uniqueIndex(
      "integration_messaging_workspaces_tenant_integration_id_idx",
    ).on(table.tenantIntegrationId),
    workspaceExternalIdUniqueIdx: uniqueIndex(
      "integration_messaging_workspaces_tenant_integration_id_external_workspace_id_idx",
    ).on(table.tenantIntegrationId, table.externalWorkspaceId),
  }),
);

export const integrationMessagingWorkspaceMembers = pgTable(
  "integration_messaging_workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messagingWorkspaceId: uuid("messaging_workspace_id")
      .references(() => integrationMessagingWorkspaces.id, {
        onDelete: "cascade",
      })
      .notNull(),
    externalMemberId: varchar("external_member_id", { length: 255 }).notNull(),
    username: varchar("username", { length: 255 }),
    displayName: text("display_name"),
    fullName: text("full_name"),
    email: varchar("email", { length: 320 }),
    avatarUrl: text("avatar_url"),
    memberType: varchar("member_type", { length: 64 }).notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    profileJson: jsonb("profile_json"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceMemberIdx: index(
      "integration_messaging_workspace_members_workspace_id_idx",
    ).on(table.messagingWorkspaceId),
    workspaceMemberUniqueIdx: uniqueIndex(
      "integration_messaging_workspace_members_workspace_id_external_member_id_idx",
    ).on(table.messagingWorkspaceId, table.externalMemberId),
  }),
);

export const integrationMessagingConversations = pgTable(
  "integration_messaging_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messagingWorkspaceId: uuid("messaging_workspace_id")
      .references(() => integrationMessagingWorkspaces.id, {
        onDelete: "cascade",
      })
      .notNull(),
    externalConversationId: varchar("external_conversation_id", {
      length: 255,
    }).notNull(),
    name: text("name"),
    conversationType: varchar("conversation_type", { length: 64 }).notNull(),
    topic: text("topic"),
    purpose: text("purpose"),
    isArchived: boolean("is_archived").default(false).notNull(),
    metadataJson: jsonb("metadata_json"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceConversationIdx: index(
      "integration_messaging_conversations_workspace_id_idx",
    ).on(table.messagingWorkspaceId),
    workspaceConversationUniqueIdx: uniqueIndex(
      "integration_messaging_conversations_workspace_id_external_conversation_id_idx",
    ).on(table.messagingWorkspaceId, table.externalConversationId),
  }),
);

export const tenantRuntimeConfigEntries = pgTable(
  "tenant_runtime_config_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    surfaceKind: varchar("surface_kind", { length: 64 }).notNull(),
    surfaceKey: varchar("surface_key", { length: 255 }).notNull(),
    schemaSource: varchar("schema_source", { length: 64 }).notNull(),
    schemaVersion: varchar("schema_version", { length: 64 }).notNull(),
    installState: varchar("install_state", { length: 64 })
      .default("installed")
      .notNull(),
    entryVersion: integer("entry_version").default(1).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    configJson: jsonb("config_json").notNull(),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
    lastValidationError: text("last_validation_error"),
    createdByType: varchar("created_by_type", { length: 64 }).notNull(),
    createdByExternalId: varchar("created_by_external_id", { length: 255 }),
    updatedByType: varchar("updated_by_type", { length: 64 }).notNull(),
    updatedByExternalId: varchar("updated_by_external_id", { length: 255 }),
    changeSummary: text("change_summary"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("tenant_runtime_config_entries_tenant_id_idx").on(
      table.tenantId,
    ),
    tenantSurfaceUniqueIdx: uniqueIndex(
      "tenant_runtime_config_entries_tenant_id_surface_kind_surface_key_idx",
    ).on(table.tenantId, table.surfaceKind, table.surfaceKey),
  }),
);

export const tenantRuntimeConfigMutations = pgTable(
  "tenant_runtime_config_mutations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    tenantRuntimeConfigEntryId: uuid(
      "tenant_runtime_config_entry_id",
    ).references(() => tenantRuntimeConfigEntries.id, { onDelete: "set null" }),
    actorType: varchar("actor_type", { length: 64 }).notNull(),
    actorExternalId: varchar("actor_external_id", { length: 255 }),
    mutationType: varchar("mutation_type", { length: 64 }).notNull(),
    expectedEntryVersion: integer("expected_entry_version"),
    resultingEntryVersion: integer("resulting_entry_version"),
    patchJson: jsonb("patch_json"),
    resultJson: jsonb("result_json"),
    desiredStateVersion: integer("desired_state_version"),
    applyRunId: uuid("apply_run_id").references(() => tenantApplyRuns.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("tenant_runtime_config_mutations_tenant_id_idx").on(
      table.tenantId,
    ),
    entryIdx: index("tenant_runtime_config_mutations_entry_id_idx").on(
      table.tenantRuntimeConfigEntryId,
    ),
  }),
);

export const tenantServers = pgTable(
  "tenant_servers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    providerServerId: varchar("provider_server_id", { length: 255 }),
    ipv4: varchar("ipv4", { length: 64 }),
    sshUsername: varchar("ssh_username", { length: 255 }),
    status: varchar("status", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("tenant_servers_tenant_id_idx").on(table.tenantId),
  }),
);

export const tenantDesiredStates = pgTable(
  "tenant_desired_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    configJson: jsonb("config_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("tenant_desired_states_tenant_id_idx").on(table.tenantId),
    tenantVersionUniqueIdx: uniqueIndex(
      "tenant_desired_states_tenant_id_version_idx",
    ).on(table.tenantId, table.version),
  }),
);

export const tenantManagedConfigVersions = pgTable(
  "tenant_managed_config_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    createdByType: varchar("created_by_type", { length: 64 }).notNull(),
    createdByExternalId: varchar("created_by_external_id", { length: 255 }),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("tenant_managed_config_versions_tenant_id_idx").on(
      table.tenantId,
    ),
    tenantVersionUniqueIdx: uniqueIndex(
      "tenant_managed_config_versions_tenant_id_version_idx",
    ).on(table.tenantId, table.version),
  }),
);

export const tenantManagedFileVersions = pgTable(
  "tenant_managed_file_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantManagedConfigVersionId: uuid("tenant_managed_config_version_id")
      .references(() => tenantManagedConfigVersions.id, { onDelete: "cascade" })
      .notNull(),
    path: varchar("path", { length: 255 }).notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    systemContent: text("system_content").notNull(),
    sharedContent: text("shared_content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    configVersionIdx: index(
      "tenant_managed_file_versions_config_version_id_idx",
    ).on(table.tenantManagedConfigVersionId),
    configVersionPathUniqueIdx: uniqueIndex(
      "tenant_managed_file_versions_config_version_id_path_idx",
    ).on(table.tenantManagedConfigVersionId, table.path),
  }),
);

export const tenantScheduledTasks = pgTable(
  "tenant_scheduled_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    taskKey: text("task_key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: varchar("status", { length: 64 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    scheduleKind: varchar("schedule_kind", { length: 32 }).notNull(),
    scheduleExpression: text("schedule_expression").notNull(),
    scheduleJson: jsonb("schedule_json"),
    timezone: varchar("timezone", { length: 128 }),
    payloadJson: jsonb("payload_json"),
    deliveryJson: jsonb("delivery_json"),
    failureAlertJson: jsonb("failure_alert_json"),
    wakeMode: varchar("wake_mode", { length: 32 }),
    deleteAfterRun: boolean("delete_after_run").default(false).notNull(),
    agentId: text("agent_id"),
    sessionKey: text("session_key"),
    sessionTarget: varchar("session_target", { length: 64 }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunStatus: varchar("last_run_status", { length: 32 }),
    lastError: text("last_error"),
    runtimeUpdatedAt: bigint("runtime_updated_at", { mode: "number" }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSyncError: text("last_sync_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("tenant_scheduled_tasks_tenant_id_idx").on(table.tenantId),
    tenantStatusIdx: index("tenant_scheduled_tasks_tenant_id_status_idx").on(
      table.tenantId,
      table.status,
    ),
    tenantNextRunIdx: index(
      "tenant_scheduled_tasks_tenant_id_next_run_at_idx",
    ).on(table.tenantId, table.nextRunAt),
    tenantTaskKeyUniqueIdx: uniqueIndex(
      "tenant_scheduled_tasks_tenant_id_task_key_idx",
    ).on(table.tenantId, table.taskKey),
  }),
);

export const tenantScheduledTaskSessions = pgTable(
  "tenant_scheduled_task_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    tenantScheduledTaskId: uuid("tenant_scheduled_task_id").references(
      () => tenantScheduledTasks.id,
      { onDelete: "set null" },
    ),
    taskKey: text("task_key").notNull(),
    taskName: text("task_name").notNull(),
    externalRunKey: text("external_run_key").notNull(),
    externalSessionId: text("external_session_id"),
    runtimeSessionKey: text("runtime_session_key"),
    triggerType: varchar("trigger_type", { length: 64 }).notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: varchar("status", { length: 64 }).notNull(),
    summary: text("summary"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("tenant_scheduled_task_sessions_tenant_id_idx").on(
      table.tenantId,
    ),
    tenantTaskIdx: index(
      "tenant_scheduled_task_sessions_tenant_scheduled_task_id_idx",
    ).on(table.tenantScheduledTaskId),
    tenantStartedIdx: index(
      "tenant_scheduled_task_sessions_tenant_id_started_at_idx",
    ).on(table.tenantId, table.startedAt),
    tenantRunKeyUniqueIdx: uniqueIndex(
      "tenant_scheduled_task_sessions_tenant_id_external_run_key_idx",
    ).on(table.tenantId, table.externalRunKey),
  }),
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobType: varchar("job_type", { length: 64 }).notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    status: varchar("status", { length: 64 }).notNull(),
    attempt: integer("attempt").default(0).notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    resultJson: jsonb("result_json"),
    error: text("error"),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    statusAvailableIdx: index("job_runs_status_available_at_idx").on(
      table.status,
      table.availableAt,
    ),
    tenantIdx: index("job_runs_tenant_id_idx").on(table.tenantId),
  }),
);

export const tenantRuntimeSecrets = pgTable(
  "tenant_runtime_secrets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    secretType: varchar("secret_type", { length: 64 }).notNull(),
    ciphertext: text("ciphertext").notNull(),
    lookupHash: varchar("lookup_hash", { length: 64 }),
    keyVersion: integer("key_version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  },
  (table) => ({
    tenantIdx: index("tenant_runtime_secrets_tenant_id_idx").on(table.tenantId),
    tenantSecretTypeUniqueIdx: uniqueIndex(
      "tenant_runtime_secrets_tenant_id_secret_type_idx",
    ).on(table.tenantId, table.secretType),
    secretTypeLookupHashUniqueIdx: uniqueIndex(
      "tenant_runtime_secrets_secret_type_lookup_hash_idx",
    )
      .on(table.secretType, table.lookupHash)
      .where(sql`${table.lookupHash} is not null`),
  }),
);

export const providerAccounts = pgTable(
  "provider_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    providerKey: varchar("provider_key", { length: 64 }).notNull(),
    displayName: text("display_name"),
    externalProjectId: varchar("external_project_id", {
      length: 255,
    }),
    externalServiceAccountId: varchar("external_service_account_id", {
      length: 255,
    }),
    externalApiKeyId: varchar("external_api_key_id", {
      length: 255,
    }),
    status: varchar("status", { length: 64 }).notNull(),
    provisionedAt: timestamp("provisioned_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("provider_accounts_tenant_id_idx").on(table.tenantId),
    tenantProviderUniqueIdx: uniqueIndex(
      "provider_accounts_tenant_id_provider_key_idx",
    ).on(table.tenantId, table.providerKey),
    tenantProviderStatusIdx: index(
      "provider_accounts_tenant_id_provider_key_status_idx",
    ).on(table.tenantId, table.providerKey, table.status),
  }),
);

export const providerCredentials = pgTable(
  "provider_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerAccountId: uuid("provider_account_id")
      .references(() => providerAccounts.id, { onDelete: "cascade" })
      .notNull(),
    credentialType: varchar("credential_type", { length: 64 }).notNull(),
    externalApiKeyId: varchar("external_api_key_id", {
      length: 255,
    }),
    externalServiceAccountId: varchar("external_service_account_id", {
      length: 255,
    }),
    ciphertext: text("ciphertext").notNull(),
    keyVersion: integer("key_version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    providerAccountIdx: index(
      "provider_credentials_provider_account_id_idx",
    ).on(table.providerAccountId),
    providerAccountCredentialTypeIdx: index(
      "provider_credentials_provider_account_id_credential_type_idx",
    ).on(table.providerAccountId, table.credentialType),
    providerAccountCredentialActiveUniqueIdx: uniqueIndex(
      "provider_credentials_provider_account_id_credential_type_active_idx",
    )
      .on(table.providerAccountId, table.credentialType)
      .where(sql`${table.revokedAt} is null`),
    providerAccountCredentialStatusIdx: index(
      "provider_credentials_provider_account_id_credential_type_revoked_at_idx",
    ).on(table.providerAccountId, table.credentialType, table.revokedAt),
  }),
);

export const providerUsageSyncStates = pgTable(
  "provider_usage_sync_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    providerAccountId: uuid("provider_account_id")
      .references(() => providerAccounts.id, { onDelete: "cascade" })
      .notNull(),
    usageType: varchar("usage_type", { length: 64 }).notNull(),
    pollIntervalSeconds: integer("poll_interval_seconds").default(60).notNull(),
    lastSuccessfulEndAt: timestamp("last_successful_end_at", {
      withTimezone: true,
    }),
    lastAttemptedAt: timestamp("last_attempted_at", {
      withTimezone: true,
    }),
    lastRowCount: integer("last_row_count").default(0).notNull(),
    consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    providerAccountUsageTypeUniqueIdx: uniqueIndex(
      "provider_usage_sync_states_provider_account_id_usage_type_idx",
    ).on(table.providerAccountId, table.usageType),
    tenantIdx: index("provider_usage_sync_states_tenant_id_idx").on(
      table.tenantId,
    ),
    providerAccountIdx: index(
      "provider_usage_sync_states_provider_account_id_idx",
    ).on(table.providerAccountId),
    providerUsageSyncIdx: index(
      "provider_usage_sync_states_provider_account_id_usage_type_last_attempted_at_idx",
    ).on(table.providerAccountId, table.usageType, table.lastAttemptedAt),
    errorIdx: index("provider_usage_sync_states_last_error_at_idx").on(
      table.lastErrorAt,
    ),
  }),
);

export const providerUsageBuckets = pgTable(
  "provider_usage_buckets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    providerAccountId: uuid("provider_account_id")
      .references(() => providerAccounts.id, { onDelete: "cascade" })
      .notNull(),
    usageType: varchar("usage_type", { length: 64 }).notNull(),
    bucketStartAt: timestamp("bucket_start_at", {
      withTimezone: true,
    }).notNull(),
    bucketEndAt: timestamp("bucket_end_at", { withTimezone: true }).notNull(),
    externalApiKeyId: varchar("external_api_key_id", { length: 255 })
      .default("")
      .notNull(),
    model: text("model").default("").notNull(),
    itemCount: integer("item_count"),
    sessionCount: integer("session_count"),
    usageBytes: bigint("usage_bytes", { mode: "number" }),
    inputTokens: bigint("input_tokens", { mode: "number" }),
    outputTokens: bigint("output_tokens", { mode: "number" }),
    inputCachedTokens: bigint("input_cached_tokens", { mode: "number" }),
    inputUncachedTokens: bigint("input_uncached_tokens", { mode: "number" }),
    inputTextTokens: bigint("input_text_tokens", { mode: "number" }),
    outputTextTokens: bigint("output_text_tokens", { mode: "number" }),
    inputAudioTokens: bigint("input_audio_tokens", { mode: "number" }),
    outputAudioTokens: bigint("output_audio_tokens", { mode: "number" }),
    inputImageTokens: bigint("input_image_tokens", { mode: "number" }),
    outputImageTokens: bigint("output_image_tokens", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    providerAccountBucketUniqueIdx: uniqueIndex(
      "provider_usage_buckets_provider_account_id_usage_type_bucket_dims_idx",
    ).on(
      table.providerAccountId,
      table.usageType,
      table.bucketStartAt,
      table.bucketEndAt,
      table.externalApiKeyId,
      table.model,
    ),
    tenantBucketStartIdx: index(
      "provider_usage_buckets_tenant_id_bucket_start_at_idx",
    ).on(table.tenantId, table.bucketStartAt),
    providerUsageBucketIdx: index(
      "provider_usage_buckets_provider_account_id_usage_type_bucket_start_at_idx",
    ).on(table.providerAccountId, table.usageType, table.bucketStartAt),
    apiKeyModelIdx: index(
      "provider_usage_buckets_external_api_key_id_model_idx",
    ).on(table.externalApiKeyId, table.model),
  }),
);

export const creditLedgerEntries = pgTable(
  "credit_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    entryType: varchar("entry_type", { length: 64 }).notNull(),
    sourceType: varchar("source_type", { length: 64 }).notNull(),
    sourceId: uuid("source_id").notNull(),
    billableUnits: bigint("billable_units", { mode: "number" })
      .default(0)
      .notNull(),
    creditsDeltaMilli: bigint("credits_delta_milli", { mode: "number" })
      .default(0)
      .notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantCreatedAtIdx: index(
      "credit_ledger_entries_tenant_id_created_at_idx",
    ).on(table.tenantId, table.createdAt),
    sourceIdx: uniqueIndex(
      "credit_ledger_entries_source_type_source_id_entry_type_idx",
    ).on(table.sourceType, table.sourceId, table.entryType),
  }),
);

export const billingCustomers = pgTable(
  "billing_customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 })
      .notNull()
      .unique(),
    defaultCurrency: varchar("default_currency", { length: 16 })
      .default("usd")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationUniqueIdx: uniqueIndex(
      "billing_customers_organization_id_idx",
    ).on(table.organizationId),
  }),
);

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 })
      .notNull()
      .unique(),
    stripePriceId: varchar("stripe_price_id", { length: 255 }),
    planKey: varchar("plan_key", { length: 64 }),
    status: varchar("status", { length: 64 }).notNull(),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationUniqueIdx: uniqueIndex(
      "billing_subscriptions_organization_id_idx",
    ).on(table.organizationId),
    organizationStatusIdx: index(
      "billing_subscriptions_organization_id_status_idx",
    ).on(table.organizationId, table.status),
  }),
);

export const billingCheckoutSessions = pgTable(
  "billing_checkout_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", {
      length: 255,
    })
      .notNull()
      .unique(),
    mode: varchar("mode", { length: 64 }).notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    planKey: varchar("plan_key", { length: 64 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    checkoutUrl: text("checkout_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationCreatedAtIdx: index(
      "billing_checkout_sessions_organization_id_created_at_idx",
    ).on(table.organizationId, table.createdAt),
  }),
);

export const billingWebhookEvents = pgTable(
  "billing_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripeEventId: varchar("stripe_event_id", { length: 255 })
      .notNull()
      .unique(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    createdAtIdx: index("billing_webhook_events_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export const creditGrants = pgTable(
  "credit_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    sourceType: varchar("source_type", { length: 64 }).notNull(),
    sourceExternalId: varchar("source_external_id", { length: 255 }).notNull(),
    planKey: varchar("plan_key", { length: 64 }),
    creditsGrantedMilli: bigint("credits_granted_milli", {
      mode: "number",
    }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ledgerEntryId: uuid("ledger_entry_id").references(
      () => creditLedgerEntries.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sourceUniqueIdx: uniqueIndex(
      "credit_grants_source_type_external_id_idx",
    ).on(table.sourceType, table.sourceExternalId),
    organizationGrantedAtIdx: index(
      "credit_grants_organization_id_granted_at_idx",
    ).on(table.organizationId, table.grantedAt),
    tenantGrantedAtIdx: index("credit_grants_tenant_id_granted_at_idx").on(
      table.tenantId,
      table.grantedAt,
    ),
    ledgerEntryUniqueIdx: uniqueIndex("credit_grants_ledger_entry_id_idx").on(
      table.ledgerEntryId,
    ),
  }),
);

export const providerUsageSettlements = pgTable(
  "provider_usage_settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerUsageBucketId: uuid("provider_usage_bucket_id")
      .references(() => providerUsageBuckets.id, { onDelete: "cascade" })
      .notNull(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    providerAccountId: uuid("provider_account_id")
      .references(() => providerAccounts.id, { onDelete: "cascade" })
      .notNull(),
    settlementStatus: varchar("settlement_status", { length: 64 }).notNull(),
    pricingVersion: varchar("pricing_version", { length: 128 }).notNull(),
    providerCostMicros: bigint("provider_cost_micros", { mode: "number" })
      .default(0)
      .notNull(),
    billableUnits: bigint("billable_units", { mode: "number" })
      .default(0)
      .notNull(),
    creditsBurnedMilli: bigint("credits_burned_milli", { mode: "number" })
      .default(0)
      .notNull(),
    ledgerEntryId: uuid("ledger_entry_id").references(
      () => creditLedgerEntries.id,
      {
        onDelete: "set null",
      },
    ),
    note: text("note"),
    settledAt: timestamp("settled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    bucketUniqueIdx: uniqueIndex(
      "provider_usage_settlements_provider_usage_bucket_id_idx",
    ).on(table.providerUsageBucketId),
    ledgerEntryUniqueIdx: uniqueIndex(
      "provider_usage_settlements_ledger_entry_id_idx",
    ).on(table.ledgerEntryId),
    tenantSettledAtIdx: index(
      "provider_usage_settlements_tenant_id_settled_at_idx",
    ).on(table.tenantId, table.settledAt),
    providerAccountSettledAtIdx: index(
      "provider_usage_settlements_provider_account_id_settled_at_idx",
    ).on(table.providerAccountId, table.settledAt),
    statusIdx: index("provider_usage_settlements_settlement_status_idx").on(
      table.settlementStatus,
    ),
  }),
);

export const tenantApplyRuns = pgTable(
  "tenant_apply_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    jobRunId: uuid("job_run_id")
      .references(() => jobRuns.id, { onDelete: "cascade" })
      .notNull(),
    desiredStateVersion: integer("desired_state_version").notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    error: text("error"),
    restartStdout: text("restart_stdout"),
    restartStderr: text("restart_stderr"),
    verifyStdout: text("verify_stdout"),
    verifyStderr: text("verify_stderr"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    jobRunUniqueIdx: uniqueIndex("tenant_apply_runs_job_run_id_idx").on(
      table.jobRunId,
    ),
    tenantIdx: index("tenant_apply_runs_tenant_id_idx").on(table.tenantId),
    tenantStatusIdx: index("tenant_apply_runs_tenant_id_status_idx").on(
      table.tenantId,
      table.status,
    ),
  }),
);

export const tenantSessions = pgTable(
  "tenant_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    sessionKey: text("session_key").notNull(),
    externalSessionId: text("external_session_id").notNull(),

    // display
    displayName: text("display_name"),
    label: text("label"),
    subject: text("subject"),

    // channel / origin
    channel: varchar("channel", { length: 64 }),
    channelProvider: varchar("channel_provider", { length: 64 }),
    chatType: varchar("chat_type", { length: 64 }),
    originFrom: text("origin_from"),
    originTo: text("origin_to"),
    originAccountId: text("origin_account_id"),
    originThreadId: text("origin_thread_id"),

    // lifecycle
    status: varchar("status", { length: 64 }).default("active").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    runtimeMs: integer("runtime_ms"),

    // usage
    model: text("model"),
    modelProvider: text("model_provider"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    cacheWriteTokens: integer("cache_write_tokens"),
    totalTokens: integer("total_tokens"),
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 10,
      scale: 6,
    }),

    // transcript
    transcriptJsonl: text("transcript_jsonl"),
    transcriptHash: varchar("transcript_hash", { length: 64 }),
    messageCount: integer("message_count"),
    lastMessageAt: bigint("last_message_at", { mode: "number" }),

    // subagent
    parentSessionKey: text("parent_session_key"),
    spawnDepth: integer("spawn_depth").default(0),
    subagentRole: varchar("subagent_role", { length: 32 }),

    // sync
    sessionUpdatedAt: bigint("session_updated_at", { mode: "number" }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSyncError: text("last_sync_error"),
    syncSource: varchar("sync_source", { length: 32 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("tenant_sessions_tenant_id_idx").on(table.tenantId),
    tenantSessionKeyUniqueIdx: uniqueIndex(
      "tenant_sessions_tenant_id_session_key_external_session_id_idx",
    ).on(table.tenantId, table.sessionKey, table.externalSessionId),
    tenantStatusIdx: index("tenant_sessions_tenant_id_status_idx").on(
      table.tenantId,
      table.status,
    ),
    tenantChannelIdx: index("tenant_sessions_tenant_id_channel_idx").on(
      table.tenantId,
      table.channel,
    ),
    tenantSessionUpdatedAtIdx: index(
      "tenant_sessions_tenant_id_session_updated_at_idx",
    ).on(table.tenantId, table.sessionUpdatedAt),
    tenantLastMessageAtIdx: index(
      "tenant_sessions_tenant_id_last_message_at_idx",
    ).on(table.tenantId, table.lastMessageAt),
  }),
);

export const userChannelIdentities = pgTable(
  "user_channel_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    displayName: text("display_name"),
    fullName: text("full_name"),
    username: text("username"),
    avatarUrl: text("avatar_url"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolutionSource: varchar("resolution_source", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userOrgIdx: index("user_channel_identities_user_id_organization_id_idx").on(
      table.userId,
      table.organizationId,
    ),
    orgProviderExternalUniqueIdx: uniqueIndex(
      "user_channel_identities_organization_id_provider_external_id_idx",
    ).on(table.organizationId, table.provider, table.externalId),
  }),
);

export const jobEvents = pgTable(
  "job_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobRunId: uuid("job_run_id")
      .references(() => jobRuns.id, { onDelete: "cascade" })
      .notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    message: text("message").notNull(),
    dataJson: jsonb("data_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    jobRunIdx: index("job_events_job_run_id_idx").on(table.jobRunId),
  }),
);

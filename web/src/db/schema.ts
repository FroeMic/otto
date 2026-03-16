import {
  boolean,
  index,
  integer,
  jsonb,
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
  name: text("name").notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
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

export const slackInstallations = pgTable(
  "slack_installations",
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
      "slack_installations_tenant_integration_id_idx",
    ).on(table.tenantIntegrationId),
  }),
);

export const integrationSecrets = pgTable(
  "integration_secrets",
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
      "integration_secrets_tenant_integration_id_idx",
    ).on(table.tenantIntegrationId),
    tenantIntegrationSecretTypeUniqueIdx: uniqueIndex(
      "integration_secrets_tenant_integration_id_secret_type_idx",
    ).on(table.tenantIntegrationId, table.secretType),
  }),
);

export const messagingWorkspaces = pgTable(
  "messaging_workspaces",
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
      "messaging_workspaces_tenant_integration_id_idx",
    ).on(table.tenantIntegrationId),
    workspaceExternalIdUniqueIdx: uniqueIndex(
      "messaging_workspaces_tenant_integration_id_external_workspace_id_idx",
    ).on(table.tenantIntegrationId, table.externalWorkspaceId),
  }),
);

export const messagingWorkspaceMembers = pgTable(
  "messaging_workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messagingWorkspaceId: uuid("messaging_workspace_id")
      .references(() => messagingWorkspaces.id, { onDelete: "cascade" })
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
      "messaging_workspace_members_workspace_id_idx",
    ).on(table.messagingWorkspaceId),
    workspaceMemberUniqueIdx: uniqueIndex(
      "messaging_workspace_members_workspace_id_external_member_id_idx",
    ).on(table.messagingWorkspaceId, table.externalMemberId),
  }),
);

export const messagingConversations = pgTable(
  "messaging_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messagingWorkspaceId: uuid("messaging_workspace_id")
      .references(() => messagingWorkspaces.id, { onDelete: "cascade" })
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
      "messaging_conversations_workspace_id_idx",
    ).on(table.messagingWorkspaceId),
    workspaceConversationUniqueIdx: uniqueIndex(
      "messaging_conversations_workspace_id_external_conversation_id_idx",
    ).on(table.messagingWorkspaceId, table.externalConversationId),
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

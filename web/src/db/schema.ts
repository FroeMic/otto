import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalId: varchar("external_id", { length: 255 }).notNull().unique(),
  name: text("name").notNull(),
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

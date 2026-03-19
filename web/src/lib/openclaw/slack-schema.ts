import { z } from "zod";

// Pinned to the OpenClaw Slack config schema shape used by the current
// runtime image line. Otto keeps its own higher-level Slack policy surface,
// then validates the rendered OpenClaw Slack projection against this schema.

const stringOrNumberSchema = z.union([z.string(), z.number()]);

const dmPolicySchema = z.enum(["pairing", "allowlist", "open", "disabled"]);

const groupPolicySchema = z.enum(["open", "disabled", "allowlist"]);

const replyToModeSchema = z.union([
  z.literal("off"),
  z.literal("first"),
  z.literal("all"),
]);

const secretInputSchema = z.union([
  z.string(),
  z.object({ ref: z.string() }).strict(),
]);

const toolPolicySchema = z
  .object({
    allow: z.array(z.string()).optional(),
    alsoAllow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.allow?.length && value.alsoAllow?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "tools policy cannot set both allow and alsoAllow in the same scope",
      });
    }
  })
  .optional();

const toolPolicyBySenderSchema = z
  .record(z.string(), toolPolicySchema)
  .optional();

const markdownConfigSchema = z
  .object({
    tables: z.enum(["native", "codeblock", "off"]).optional(),
  })
  .strict()
  .optional();

const providerCommandsSchema = z
  .object({
    native: z.union([z.boolean(), z.literal("auto")]).optional(),
    nativeSkills: z.union([z.boolean(), z.literal("auto")]).optional(),
  })
  .strict()
  .optional();

const blockStreamingCoalesceSchema = z
  .object({
    idleMs: z.number().int().nonnegative().optional(),
    maxChars: z.number().int().positive().optional(),
    minChars: z.number().int().positive().optional(),
  })
  .strict();

const dmConfigSchema = z
  .object({
    historyLimit: z.number().int().min(0).optional(),
  })
  .strict();

const channelHeartbeatVisibilitySchema = z
  .object({
    showAlerts: z.boolean().optional(),
    showOk: z.boolean().optional(),
    useIndicator: z.boolean().optional(),
  })
  .strict()
  .optional();

const slackCapabilitiesSchema = z.union([
  z.array(z.string()),
  z.object({ interactiveReplies: z.boolean().optional() }).strict(),
]);

const slackDmSchema = z
  .object({
    allowFrom: z.array(stringOrNumberSchema).optional(),
    enabled: z.boolean().optional(),
    groupChannels: z.array(stringOrNumberSchema).optional(),
    groupEnabled: z.boolean().optional(),
    policy: dmPolicySchema.optional(),
    replyToMode: replyToModeSchema.optional(),
  })
  .strict();

const slackChannelSchema = z
  .object({
    allow: z.boolean().optional(),
    allowBots: z.boolean().optional(),
    enabled: z.boolean().optional(),
    requireMention: z.boolean().optional(),
    skills: z.array(z.string()).optional(),
    systemPrompt: z.string().optional(),
    tools: toolPolicySchema,
    toolsBySender: toolPolicyBySenderSchema,
    users: z.array(stringOrNumberSchema).optional(),
  })
  .strict();

const slackThreadSchema = z
  .object({
    historyScope: z.enum(["thread", "channel"]).optional(),
    inheritParent: z.boolean().optional(),
    initialHistoryLimit: z.number().int().min(0).optional(),
  })
  .strict();

const slackReplyToModeByChatTypeSchema = z
  .object({
    channel: replyToModeSchema.optional(),
    direct: replyToModeSchema.optional(),
    group: replyToModeSchema.optional(),
  })
  .strict();

const slackActionSchema = z
  .object({
    channelInfo: z.boolean().optional(),
    emojiList: z.boolean().optional(),
    memberInfo: z.boolean().optional(),
    messages: z.boolean().optional(),
    permissions: z.boolean().optional(),
    pins: z.boolean().optional(),
    reactions: z.boolean().optional(),
    search: z.boolean().optional(),
  })
  .strict()
  .optional();

const slackSlashCommandSchema = z
  .object({
    enabled: z.boolean().optional(),
    ephemeral: z.boolean().optional(),
    name: z.string().optional(),
    sessionPrefix: z.string().optional(),
  })
  .strict()
  .optional();

const slackAccountSchema = z
  .object({
    ackReaction: z.string().optional(),
    actions: slackActionSchema,
    allowBots: z.boolean().optional(),
    allowFrom: z.array(stringOrNumberSchema).optional(),
    appToken: secretInputSchema.optional(),
    blockStreaming: z.boolean().optional(),
    blockStreamingCoalesce: blockStreamingCoalesceSchema.optional(),
    botToken: secretInputSchema.optional(),
    capabilities: slackCapabilitiesSchema.optional(),
    channels: z.record(z.string(), slackChannelSchema.optional()).optional(),
    chunkMode: z.enum(["length", "newline"]).optional(),
    commands: providerCommandsSchema,
    configWrites: z.boolean().optional(),
    dangerouslyAllowNameMatching: z.boolean().optional(),
    defaultTo: z.string().optional(),
    dm: slackDmSchema.optional(),
    dmHistoryLimit: z.number().int().min(0).optional(),
    dmPolicy: dmPolicySchema.optional(),
    dms: z.record(z.string(), dmConfigSchema.optional()).optional(),
    enabled: z.boolean().optional(),
    groupPolicy: groupPolicySchema.optional(),
    heartbeat: channelHeartbeatVisibilitySchema,
    historyLimit: z.number().int().min(0).optional(),
    markdown: markdownConfigSchema,
    mediaMaxMb: z.number().positive().optional(),
    mode: z.enum(["socket", "http"]).optional(),
    name: z.string().optional(),
    nativeStreaming: z.boolean().optional(),
    reactionAllowlist: z.array(stringOrNumberSchema).optional(),
    reactionNotifications: z
      .enum(["off", "own", "all", "allowlist"])
      .optional(),
    replyToMode: replyToModeSchema.optional(),
    replyToModeByChatType: slackReplyToModeByChatTypeSchema.optional(),
    requireMention: z.boolean().optional(),
    responsePrefix: z.string().optional(),
    signingSecret: secretInputSchema.optional(),
    slashCommand: slackSlashCommandSchema,
    streamMode: z.enum(["replace", "status_final", "append"]).optional(),
    streaming: z
      .union([z.boolean(), z.enum(["off", "partial", "block", "progress"])])
      .optional(),
    textChunkLimit: z.number().int().positive().optional(),
    thread: slackThreadSchema.optional(),
    typingReaction: z.string().optional(),
    userToken: secretInputSchema.optional(),
    userTokenReadOnly: z.boolean().optional().default(true),
    webhookPath: z.string().optional(),
  })
  .strict();

export const openClawSlackConfigSchema = slackAccountSchema
  .extend({
    accounts: z.record(z.string(), slackAccountSchema.optional()).optional(),
    defaultAccount: z.string().optional(),
    groupPolicy: groupPolicySchema.optional().default("allowlist"),
    mode: z.enum(["socket", "http"]).optional().default("socket"),
    webhookPath: z.string().optional().default("/slack/events"),
  })
  .superRefine((value, ctx) => {
    const dmPolicy = value.dmPolicy ?? value.dm?.policy ?? "pairing";
    const allowFrom = value.allowFrom ?? value.dm?.allowFrom;
    const allowFromPath =
      value.allowFrom !== undefined ? ["allowFrom"] : ["dm", "allowFrom"];

    if (dmPolicy === "open" && !allowFrom?.includes("*")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dmPolicy="open" requires allowFrom to include "*"',
        path: allowFromPath,
      });
    }

    if (dmPolicy === "allowlist" && (!allowFrom || allowFrom.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'dmPolicy="allowlist" requires allowFrom to contain at least one sender ID',
        path: allowFromPath,
      });
    }

    if (value.accounts) {
      for (const [accountId, account] of Object.entries(value.accounts)) {
        if (!account || account.enabled === false) {
          continue;
        }

        const effectivePolicy =
          account.dmPolicy ??
          account.dm?.policy ??
          value.dmPolicy ??
          value.dm?.policy ??
          "pairing";
        const effectiveAllowFrom =
          account.allowFrom ??
          account.dm?.allowFrom ??
          value.allowFrom ??
          value.dm?.allowFrom;

        if (effectivePolicy === "open" && !effectiveAllowFrom?.includes("*")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'account dmPolicy="open" requires allowFrom to include "*"',
            path: ["accounts", accountId, "allowFrom"],
          });
        }

        if (
          effectivePolicy === "allowlist" &&
          (!effectiveAllowFrom || effectiveAllowFrom.length === 0)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'account dmPolicy="allowlist" requires allowFrom to contain at least one sender ID',
            path: ["accounts", accountId, "allowFrom"],
          });
        }
      }
    }

    if (value.mode === "http" && !value.signingSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mode="http" requires signingSecret',
        path: ["signingSecret"],
      });
    }
  });

export type OpenClawSlackConfig = z.infer<typeof openClawSlackConfigSchema>;

export function validateOpenClawSlackConfig(value: unknown): OpenClawSlackConfig {
  return openClawSlackConfigSchema.parse(value);
}

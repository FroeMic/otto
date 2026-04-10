import { z } from "zod";

export const WHATSAPP_RUNTIME_CONFIG_SURFACE_KIND = "channel";
export const WHATSAPP_RUNTIME_CONFIG_SURFACE_KEY = "whatsapp";
export const WHATSAPP_RUNTIME_CONFIG_SCHEMA_SOURCE = "otto_builtin";
export const WHATSAPP_RUNTIME_CONFIG_SCHEMA_VERSION = "1";
export const WHATSAPP_RUNTIME_CONFIG_LABEL = "WhatsApp";
export const WHATSAPP_RUNTIME_CONFIG_DESCRIPTION =
  "Connect a WhatsApp Business number and manage DM access, groups, and reply behavior.";

const whatsappDmPolicySchema = z.enum(["pairing", "allowlist", "disabled"]);
const whatsappGroupPolicySchema = z.enum(["disabled", "allowlist"]);

function normalizeWhatsAppPhone(value: string) {
  const digits = value.replaceAll(/[^\d]/g, "");

  if (digits.length < 7 || digits.length > 15) {
    throw new Error(
      `WhatsApp numbers must be valid E.164 values with 7-15 digits: ${value}`,
    );
  }

  return `+${digits}`;
}

function normalizeWhatsAppGroupId(value: string) {
  const trimmed = value.trim();
  const withSuffix =
    trimmed.endsWith("@g.us") || trimmed.endsWith("@G.US")
      ? trimmed.replace(/@g\.us$/i, "@g.us")
      : /^[\d:-]+$/.test(trimmed)
        ? `${trimmed}@g.us`
        : trimmed;

  if (!/^[\d:-]+@g\.us$/.test(withSuffix)) {
    throw new Error(`WhatsApp group IDs must end in @g.us: ${value}`);
  }

  return withSuffix;
}

function normalizeUniqueStringList(
  values: string[],
  normalize: (value: string) => string,
) {
  return [
    ...new Set(values.map((value) => normalize(value.trim())).filter(Boolean)),
  ];
}

const phoneListSchema = z
  .array(z.string().trim().min(1))
  .default([])
  .transform((values) =>
    normalizeUniqueStringList(values, normalizeWhatsAppPhone),
  );

const groupIdListSchema = z
  .array(z.string().trim().min(1))
  .default([])
  .transform((values) =>
    normalizeUniqueStringList(values, normalizeWhatsAppGroupId),
  );

const whatsappRuntimeConfigObjectSchema = z.object({
  ackReactionEnabled: z.boolean().default(false),
  allowedGroupIds: groupIdListSchema,
  allowedNumbers: phoneListSchema,
  dmPolicy: whatsappDmPolicySchema.default("pairing"),
  groupAllowedNumbers: phoneListSchema,
  groupPolicy: whatsappGroupPolicySchema.default("disabled"),
  requireMentionInGroups: z.boolean().default(true),
});

export const whatsappRuntimeConfigSchema = whatsappRuntimeConfigObjectSchema
  .strict()
  .superRefine((value, ctx) => {
    if (value.dmPolicy === "allowlist" && value.allowedNumbers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Allowlist DMs require at least one allowed WhatsApp number.",
        path: ["allowedNumbers"],
      });
    }

    if (
      value.groupPolicy === "allowlist" &&
      value.allowedGroupIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Allowlisted groups require at least one WhatsApp group ID ending in @g.us.",
        path: ["allowedGroupIds"],
      });
    }

    if (
      value.groupPolicy === "allowlist" &&
      value.groupAllowedNumbers.length === 0 &&
      value.allowedNumbers.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Allowlisted groups require at least one allowed sender number, either in group senders or DM allowlist.",
        path: ["groupAllowedNumbers"],
      });
    }
  });

export type WhatsAppRuntimeConfig = z.infer<typeof whatsappRuntimeConfigSchema>;

export const whatsappRuntimeConfigPatchSchema = z
  .object({
    ackReactionEnabled: z.boolean().optional(),
    allowedGroupIds: z.array(z.string().trim().min(1)).optional(),
    allowedNumbers: z.array(z.string().trim().min(1)).optional(),
    dmPolicy: whatsappDmPolicySchema.optional(),
    groupAllowedNumbers: z.array(z.string().trim().min(1)).optional(),
    groupPolicy: whatsappGroupPolicySchema.optional(),
    requireMentionInGroups: z.boolean().optional(),
  })
  .strict();

export const whatsappRuntimeConfigJsonSchema = {
  additionalProperties: false,
  properties: {
    ackReactionEnabled: {
      default: false,
      type: "boolean",
    },
    allowedGroupIds: {
      default: [],
      items: {
        minLength: 1,
        type: "string",
      },
      type: "array",
    },
    allowedNumbers: {
      default: [],
      items: {
        minLength: 1,
        type: "string",
      },
      type: "array",
    },
    dmPolicy: {
      default: "pairing",
      enum: ["pairing", "allowlist", "disabled"],
      type: "string",
    },
    groupAllowedNumbers: {
      default: [],
      items: {
        minLength: 1,
        type: "string",
      },
      type: "array",
    },
    groupPolicy: {
      default: "disabled",
      enum: ["disabled", "allowlist"],
      type: "string",
    },
    requireMentionInGroups: {
      default: true,
      type: "boolean",
    },
  },
  type: "object",
} as const;

export const whatsappRuntimeConfigUiHints = {
  description: WHATSAPP_RUNTIME_CONFIG_DESCRIPTION,
  fields: {
    ackReactionEnabled: {
      kind: "boolean",
      label: "Ack reaction",
    },
    allowedGroupIds: {
      kind: "string_array",
      label: "Allowed group IDs",
    },
    allowedNumbers: {
      kind: "string_array",
      label: "Allowed numbers",
    },
    dmPolicy: {
      kind: "enum",
      label: "DM access mode",
      options: [
        {
          label: "Pairing",
          value: "pairing",
        },
        {
          label: "Allowlist only",
          value: "allowlist",
        },
        {
          label: "Disabled",
          value: "disabled",
        },
      ],
    },
    groupAllowedNumbers: {
      kind: "string_array",
      label: "Allowed group senders",
    },
    groupPolicy: {
      kind: "enum",
      label: "Group access mode",
      options: [
        {
          label: "Disabled",
          value: "disabled",
        },
        {
          label: "Allowlist",
          value: "allowlist",
        },
      ],
    },
    requireMentionInGroups: {
      kind: "boolean",
      label: "Require mention in groups",
    },
  },
  label: WHATSAPP_RUNTIME_CONFIG_LABEL,
} as const;

export function getDefaultWhatsAppRuntimeConfig(): WhatsAppRuntimeConfig {
  return whatsappRuntimeConfigSchema.parse({});
}

export function parseWhatsAppRuntimeConfig(
  value: unknown,
): WhatsAppRuntimeConfig {
  return whatsappRuntimeConfigSchema.parse(value);
}

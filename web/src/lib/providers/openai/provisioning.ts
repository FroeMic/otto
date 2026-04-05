import { getControlPlaneOpenAiAdminApiKey, getEnv } from "@/lib/env";
import type {
  ProviderProvisioner,
  ProvisionTenantCredentialResult,
} from "@/lib/providers/types";

const OPENAI_ADMIN_API_BASE_URL = "https://api.openai.com/v1";
const OPENAI_PROVIDER_KEY = "openai";

type OpenAiProject = {
  id: string;
  name: string;
};

type OpenAiServiceAccount = {
  apiKey: {
    id: string | null;
    value: string;
  };
  id: string;
  name: string;
};

export class OpenAiProvisioner implements ProviderProvisioner {
  async createTenantCredential(input: {
    tenantId: string;
    tenantName: string;
    verify?: boolean;
  }): Promise<ProvisionTenantCredentialResult> {
    const projectName = buildOpenAiProjectName(
      input.tenantName,
      input.tenantId,
    );
    const serviceAccountName = buildOpenAiServiceAccountName(
      input.tenantName,
      input.tenantId,
    );
    const project = await createOpenAiProject(projectName);
    const serviceAccount = await createOpenAiServiceAccount({
      name: serviceAccountName,
      projectId: project.id,
    });

    if (input.verify !== false) {
      await verifyOpenAiApiKey(serviceAccount.apiKey.value);
    }

    return {
      apiKey: serviceAccount.apiKey.value,
      apiKeyId: serviceAccount.apiKey.id,
      displayName: project.name,
      projectId: project.id,
      providerKey: OPENAI_PROVIDER_KEY,
      serviceAccountId: serviceAccount.id,
    };
  }
}

async function createOpenAiProject(name: string): Promise<OpenAiProject> {
  const body = await fetchOpenAiAdminJson("/organization/projects", {
    body: JSON.stringify({ name }),
    method: "POST",
  });

  if (typeof body.id !== "string" || typeof body.name !== "string") {
    throw new Error("OpenAI project creation returned an invalid response");
  }

  return {
    id: body.id,
    name: body.name,
  };
}

async function createOpenAiServiceAccount(input: {
  projectId: string;
  name: string;
}): Promise<OpenAiServiceAccount> {
  const body = await fetchOpenAiAdminJson(
    `/organization/projects/${input.projectId}/service_accounts`,
    {
      body: JSON.stringify({ name: input.name }),
      method: "POST",
    },
  );
  const apiKeyEnvelope = getRecord(
    body.api_key,
    "OpenAI service account api_key",
  );
  const apiKeyValue = getString(
    apiKeyEnvelope.value ??
      apiKeyEnvelope.key ??
      apiKeyEnvelope.secret ??
      apiKeyEnvelope.unredacted_value,
    "OpenAI service account api_key value",
  );

  return {
    apiKey: {
      id: getNullableString(apiKeyEnvelope.id),
      value: apiKeyValue,
    },
    id: getString(body.id, "OpenAI service account id"),
    name: getString(body.name, "OpenAI service account name"),
  };
}

async function verifyOpenAiApiKey(apiKey: string) {
  const configuredModel = getEnv().RUNTIME_MODEL_PRIMARY;
  const model = normalizeOpenAiModel(configuredModel);

  if (!model) {
    throw new Error(
      `RUNTIME_MODEL_PRIMARY must be an OpenAI model to verify the provisioned key. Received: ${configuredModel}`,
    );
  }

  const response = await fetch(`${OPENAI_ADMIN_API_BASE_URL}/responses`, {
    body: JSON.stringify({
      input: "Reply with exactly PONG.",
      max_output_tokens: 32,
      model,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(buildOpenAiErrorMessage(body, response.status));
  }
}

async function fetchOpenAiAdminJson(
  path: string,
  init: {
    body?: string;
    method: "GET" | "POST";
  },
) {
  const response = await fetch(`${OPENAI_ADMIN_API_BASE_URL}${path}`, {
    body: init.body,
    headers: {
      Authorization: `Bearer ${getControlPlaneOpenAiAdminApiKey()}`,
      "Content-Type": "application/json",
    },
    method: init.method,
  });
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(buildOpenAiErrorMessage(body, response.status));
  }

  return getRecord(body, "OpenAI admin response");
}

function buildOpenAiProjectName(tenantName: string, tenantId: string) {
  return truncateLabel(`Otto ${tenantName.trim()} ${tenantId.slice(0, 8)}`, 64);
}

function buildOpenAiServiceAccountName(tenantName: string, tenantId: string) {
  const normalizedName = tenantName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return truncateLabel(
    `otto-${normalizedName || "tenant"}-${tenantId.slice(0, 8)}`,
    64,
  );
}

function truncateLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength);
}

function normalizeOpenAiModel(value: string) {
  if (value.startsWith("openai/")) {
    return value.slice("openai/".length);
  }

  if (!value.includes("/")) {
    return value;
  }

  return null;
}

function getRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} was not an object`);
  }

  return value as Record<string, unknown>;
}

function getString(value: unknown, label: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} was missing`);
  }

  return value;
}

function getNullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function buildOpenAiErrorMessage(body: unknown, status: number) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const error =
    record.error &&
    typeof record.error === "object" &&
    !Array.isArray(record.error)
      ? (record.error as Record<string, unknown>)
      : null;

  if (!error) {
    return `OpenAI request failed with HTTP ${status}`;
  }

  const message =
    typeof error.message === "string"
      ? error.message
      : `OpenAI request failed with HTTP ${status}`;
  const code =
    typeof error.code === "string" && error.code.length > 0
      ? ` code=${error.code}`
      : "";
  const type =
    typeof error.type === "string" && error.type.length > 0
      ? ` type=${error.type}`
      : "";

  return `${message}${code}${type}`;
}

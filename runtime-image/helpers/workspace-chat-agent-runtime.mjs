import path from "node:path";

export const DEFAULT_AGENT_ID = "main";
export const DEFAULT_PROVIDER = "openai";
export const DEFAULT_MODEL = "gpt-5.4";

export function resolveWorkspaceChatAgentRuntime({ cfg, env = process.env }) {
  const agentId = resolveDefaultAgentId(cfg);
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId, env);
  const agentDir = resolveAgentDir(cfg, agentId, env);
  const modelRef = resolveAgentEffectiveModelPrimary(cfg, agentId);
  const parsedModel = parseModelRef(modelRef, DEFAULT_PROVIDER);

  return {
    agentDir,
    agentId,
    model: parsedModel.model,
    modelRef,
    provider: parsedModel.provider,
    workspaceDir,
  };
}

function resolveDefaultAgentId(cfg) {
  const agents = listAgentEntries(cfg);
  if (agents.length === 0) {
    return DEFAULT_AGENT_ID;
  }

  const chosen = agents.find((entry) => entry?.default)?.id ?? agents[0]?.id;
  return normalizeAgentId(chosen);
}

function resolveAgentWorkspaceDir(cfg, agentId, env) {
  const configured = readStringValue(resolveAgentEntry(cfg, agentId)?.workspace);
  if (configured) {
    return resolveUserPath(configured, env);
  }

  const defaultWorkspace = readStringValue(cfg?.agents?.defaults?.workspace);
  if (agentId === resolveDefaultAgentId(cfg)) {
    if (defaultWorkspace) {
      return resolveUserPath(defaultWorkspace, env);
    }
    return path.join(resolveStateDir(env), "workspace");
  }

  if (defaultWorkspace) {
    return path.join(resolveUserPath(defaultWorkspace, env), agentId);
  }

  return path.join(resolveStateDir(env), `workspace-${agentId}`);
}

function resolveAgentDir(cfg, agentId, env) {
  const configured = readStringValue(resolveAgentEntry(cfg, agentId)?.agentDir);
  if (configured) {
    return resolveUserPath(configured, env);
  }

  return path.join(resolveStateDir(env), "agents", agentId, "agent");
}

function resolveAgentEffectiveModelPrimary(cfg, agentId) {
  return (
    resolvePrimaryModelValue(resolveAgentEntry(cfg, agentId)?.model) ??
    resolvePrimaryModelValue(cfg?.agents?.defaults?.model)
  );
}

function resolvePrimaryModelValue(raw) {
  if (typeof raw === "string") {
    const normalized = raw.trim();
    return normalized || undefined;
  }

  if (raw && typeof raw === "object" && typeof raw.primary === "string") {
    const normalized = raw.primary.trim();
    return normalized || undefined;
  }

  return undefined;
}

function parseModelRef(modelRef, defaultProvider) {
  const normalizedDefaultProvider = (defaultProvider || DEFAULT_PROVIDER).trim() || DEFAULT_PROVIDER;
  const normalizedModelRef = String(modelRef || "").trim();

  if (!normalizedModelRef) {
    return {
      model: DEFAULT_MODEL,
      provider: normalizedDefaultProvider,
    };
  }

  const slashIndex = normalizedModelRef.indexOf("/");
  if (slashIndex <= 0 || slashIndex === normalizedModelRef.length - 1) {
    return {
      model: normalizedModelRef,
      provider: normalizedDefaultProvider,
    };
  }

  return {
    model: normalizedModelRef.slice(slashIndex + 1).trim() || DEFAULT_MODEL,
    provider: normalizedModelRef.slice(0, slashIndex).trim() || normalizedDefaultProvider,
  };
}

function listAgentEntries(cfg) {
  const list = cfg?.agents?.list;
  return Array.isArray(list) ? list.filter(Boolean) : [];
}

function resolveAgentEntry(cfg, agentId) {
  const normalizedAgentId = normalizeAgentId(agentId);
  return listAgentEntries(cfg).find((entry) => normalizeAgentId(entry?.id) === normalizedAgentId);
}

function normalizeAgentId(value) {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) {
    return DEFAULT_AGENT_ID;
  }

  const normalized = trimmed
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/g, "")
    .replace(/-+$/g, "")
    .slice(0, 64);

  return normalized || DEFAULT_AGENT_ID;
}

function readStringValue(value) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function resolveStateDir(env) {
  const configured = readStringValue(env?.OPENCLAW_HOME);
  if (configured) {
    return resolveUserPath(configured, env);
  }

  const home = readStringValue(env?.HOME);
  if (home) {
    return path.join(resolveUserPath(home, env), ".openclaw");
  }

  return "/home/node/.openclaw";
}

function resolveUserPath(value, env) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return normalized;
  }

  if (normalized === "~") {
    return readStringValue(env?.HOME) || normalized;
  }

  if (normalized.startsWith("~/")) {
    const home = readStringValue(env?.HOME);
    if (home) {
      return path.join(home, normalized.slice(2));
    }
  }

  return normalized;
}

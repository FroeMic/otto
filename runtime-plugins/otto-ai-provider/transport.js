const SUPPORTED_OPENAI_PROXY_TRANSPORTS = new Set(["sse", "websocket"]);

export function resolveOpenAiProxyTransport(env = process.env) {
  const rawValue = env?.OTTO_OPENAI_PROXY_TRANSPORT;
  const normalized = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";

  if (!normalized) {
    return { transport: "sse", source: "default" };
  }

  if (SUPPORTED_OPENAI_PROXY_TRANSPORTS.has(normalized)) {
    return { transport: normalized, source: "env" };
  }

  throw new Error(
    `Invalid OTTO_OPENAI_PROXY_TRANSPORT "${rawValue}". Expected "sse" or "websocket".`,
  );
}

export function toOpenAiProxyWebSocketUrl(baseUrl) {
  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    throw new Error("OpenAI proxy WebSocket base URL is required.");
  }

  const url = new URL(baseUrl);
  if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else {
    throw new Error(`Unsupported OpenAI proxy WebSocket protocol "${url.protocol}".`);
  }

  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/responses`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

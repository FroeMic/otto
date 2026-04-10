import { getTenantCreditBalanceMilli } from "@/db/credit-ledger";
import { getTenantOpenAiApiKey } from "@/db/provider-accounts";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_AUDIO_TRANSCRIPTIONS_URL =
  "https://api.openai.com/v1/audio/transcriptions";
const HOP_BY_HOP_HEADERS = new Set([
  "authorization",
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export class OpenAiProxyError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "OpenAiProxyError";
    this.status = status;
  }
}

export async function proxyOpenAiResponsesRequest(input: {
  request: Request;
  tenantId: string;
}) {
  return proxyOpenAiRequest({
    request: input.request,
    tenantId: input.tenantId,
    upstreamUrl: OPENAI_RESPONSES_URL,
  });
}

export async function proxyOpenAiAudioTranscriptionsRequest(input: {
  request: Request;
  tenantId: string;
}) {
  const apiKey = await getTenantOpenAiApiKey(input.tenantId);
  const balanceCreditsMilli = await getTenantCreditBalanceMilli(input.tenantId);

  assertTenantCreditsAvailable({
    balanceCreditsMilli,
    tenantId: input.tenantId,
  });

  if (!apiKey) {
    throw new OpenAiProxyError(
      "This workspace does not have an active OpenAI API key configured.",
      503,
    );
  }

  // The OpenClaw runtime sends multipart/form-data bodies but an upstream
  // fetch quirk can set the Content-Type header to text/plain instead of
  // multipart/form-data. The raw body IS correctly multipart-encoded — only
  // the header is wrong. Detect the boundary from the body and reconstruct
  // the correct Content-Type before forwarding to OpenAI.
  const bodyBuffer = Buffer.from(await input.request.arrayBuffer());
  const incomingContentType = input.request.headers.get("content-type");
  let contentType = incomingContentType ?? "";

  if (!contentType.startsWith("multipart/form-data")) {
    const firstLine = bodyBuffer.subarray(0, 200).toString("utf-8").split("\r\n")[0];
    if (firstLine.startsWith("--")) {
      const boundary = firstLine.slice(2);
      contentType = `multipart/form-data; boundary=${boundary}`;
      console.log("[audio-proxy:web] fixed Content-Type from incoming", {
        original: incomingContentType,
        detected: contentType,
      });
    } else {
      console.error("[audio-proxy:web] body does not look like multipart", {
        contentType: incomingContentType,
        firstBytes: firstLine.slice(0, 60),
      });
    }
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(OPENAI_AUDIO_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": contentType,
      },
      body: bodyBuffer,
    });
  } catch (error) {
    throw new OpenAiProxyError(
      error instanceof Error
        ? `OpenAI upstream request failed: ${error.message}`
        : "OpenAI upstream request failed.",
      502,
    );
  }

  console.log("[audio-proxy:web] upstream response", {
    status: upstreamResponse.status,
  });

  return new Response(upstreamResponse.body, {
    headers: buildOpenAiResponseHeaders(upstreamResponse.headers),
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  });
}

async function proxyOpenAiRequest(input: {
  request: Request;
  tenantId: string;
  upstreamUrl: string;
}) {
  const apiKey = await getTenantOpenAiApiKey(input.tenantId);
  const balanceCreditsMilli = await getTenantCreditBalanceMilli(input.tenantId);

  assertTenantCreditsAvailable({
    balanceCreditsMilli,
    tenantId: input.tenantId,
  });

  if (!apiKey) {
    throw new OpenAiProxyError(
      "This workspace does not have an active OpenAI API key configured.",
      503,
    );
  }

  const bodyBuffer = Buffer.from(await input.request.arrayBuffer());
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(input.upstreamUrl, {
      method: "POST",
      headers: buildOpenAiRequestHeaders({
        apiKey,
        request: input.request,
      }),
      body: bodyBuffer,
    });
  } catch (error) {
    throw new OpenAiProxyError(
      error instanceof Error
        ? `OpenAI upstream request failed: ${error.message}`
        : "OpenAI upstream request failed.",
      502,
    );
  }

  return new Response(upstreamResponse.body, {
    headers: buildOpenAiResponseHeaders(upstreamResponse.headers),
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  });
}

export function assertTenantCreditsAvailable(input: {
  balanceCreditsMilli: number;
  tenantId: string;
}) {
  if (input.balanceCreditsMilli > 0) {
    return;
  }

  console.warn(
    `[runtime-ai] blocked tenant=${input.tenantId} due to exhausted balance balanceCreditsMilli=${input.balanceCreditsMilli}`,
  );
  throw new OpenAiProxyError(
    "You exceeded your current quota, please check your plan and billing details. Cause: You have run out of credits or hit your maximum monthly spend. Solution: Buy more credits or increase your limits.",
    429,
  );
}

function buildOpenAiRequestHeaders(input: {
  apiKey: string;
  request: Request;
}) {
  const headers = new Headers();

  for (const [name, value] of input.request.headers.entries()) {
    const lowerName = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerName)) {
      continue;
    }
    headers.set(name, value);
  }

  headers.set("Authorization", `Bearer ${input.apiKey}`);
  return headers;
}

function buildOpenAiResponseHeaders(upstreamHeaders: Headers) {
  const headers = new Headers();

  for (const [name, value] of upstreamHeaders.entries()) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue;
    }
    headers.set(name, value);
  }

  headers.set("Cache-Control", "no-store");
  return headers;
}

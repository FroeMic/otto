import { getTenantCreditBalanceMilli } from "../../db/credit-ledger";
import { getTenantOpenAiApiKey } from "../../db/provider-accounts";

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
  return proxyOpenAiRequest({
    request: input.request,
    tenantId: input.tenantId,
    upstreamUrl: OPENAI_AUDIO_TRANSCRIPTIONS_URL,
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

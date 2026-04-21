import { MinimalWebSocketClient } from "./websocket-client.js";
import { toOpenAiProxyWebSocketUrl } from "./transport.js";

const PAYLOAD_CAPTURED = Symbol("openai-proxy-payload-captured");

export function createOpenAiProxyWebSocketStreamFn(baseStreamFn, diagnostics) {
  if (typeof baseStreamFn !== "function") {
    throw new Error("OpenAI proxy WebSocket transport requires an SSE payload builder.");
  }

  return async (model, context, options = {}) => {
    const eventStream = new AssistantMessageEventStream();
    queueMicrotask(() => {
      void runOpenAiProxyWebSocketStream({
        baseStreamFn,
        context,
        diagnostics,
        eventStream,
        model,
        options,
      });
    });
    return eventStream;
  };
}

async function runOpenAiProxyWebSocketStream(params) {
  const output = buildAssistantMessage({
    model: params.model,
    content: [],
    stopReason: "stop",
  });

  let client;
  try {
    const payload = await captureResponseCreatePayload({
      baseStreamFn: params.baseStreamFn,
      model: params.model,
      context: params.context,
      options: params.options,
    });
    const wsPayload = normalizeWebSocketPayload(payload);
    const wsUrl = toOpenAiProxyWebSocketUrl(params.model?.baseUrl);
    const apiKey = resolveOpenAiProxyWebSocketTenantToken(params.options);

    client = new MinimalWebSocketClient(wsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const signal = params.options?.signal;
    const abort = () => {
      client?.close(1000, "aborted");
    };
    signal?.addEventListener?.("abort", abort, { once: true });

    await client.connect();
    params.diagnostics?.debug?.("websocket stream connected", {
      modelId: params.model?.id,
      provider: params.model?.provider,
      urlHost: safeUrlHost(wsUrl),
    });
    params.eventStream.push({ type: "start", partial: output });
    client.sendText(JSON.stringify(wsPayload));
    await consumeWebSocketEvents(client, params.eventStream, output, params.model, signal);
    signal?.removeEventListener?.("abort", abort);
  } catch (error) {
    output.stopReason = params.options?.signal?.aborted ? "aborted" : "error";
    output.errorMessage = error instanceof Error ? error.message : String(error);
    params.eventStream.push({ type: "error", reason: output.stopReason, error: output });
    params.eventStream.end(output);
  } finally {
    client?.close();
  }
}

export function resolveOpenAiProxyWebSocketTenantToken(options = {}, env = process.env) {
  const optionToken = normalizeToken(options?.apiKey);
  if (optionToken) {
    return optionToken;
  }

  const envToken = normalizeToken(env?.TENANT_TOKEN);
  if (envToken) {
    return envToken;
  }

  throw new Error("OpenAI proxy WebSocket transport requires a tenant token.");
}

function normalizeToken(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function captureResponseCreatePayload(params) {
  let captured;
  const baseOnPayload = params.options?.onPayload;
  const captureOptions = {
    ...params.options,
    transport: "sse",
    onPayload: async (payload, payloadModel) => {
      captured = (await baseOnPayload?.(payload, payloadModel)) ?? payload;
      throw PAYLOAD_CAPTURED;
    },
  };

  const stream = await params.baseStreamFn(
    params.model,
    params.context,
    captureOptions,
  );

  try {
    for await (const _event of stream) {
      // Drain until the SSE transport converts the sentinel into an error event.
    }
  } catch (error) {
    if (error !== PAYLOAD_CAPTURED) {
      throw error;
    }
  }

  if (!captured || typeof captured !== "object") {
    throw new Error("Unable to build OpenAI Responses payload for WebSocket transport.");
  }
  return captured;
}

function normalizeWebSocketPayload(payload) {
  const normalized = { ...payload, type: "response.create" };
  delete normalized.stream;
  return normalized;
}

function consumeWebSocketEvents(client, eventStream, output, model, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      client.off("message", onMessage);
      client.off("error", onError);
      client.off("close", onClose);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    const onError = (error) => finish(error);
    const onClose = () => {
      if (signal?.aborted) {
        finish(new Error("aborted"));
        return;
      }
      finish(new Error("OpenAI proxy WebSocket closed before response.completed."));
    };
    const onMessage = (message) => {
      try {
        const event = JSON.parse(message);
        processResponseEvent(event, output, eventStream, model);
        if (event?.type === "response.completed") {
          eventStream.push({
            type: "done",
            reason: output.stopReason === "toolUse" ? "toolUse" : "stop",
            message: output,
          });
          eventStream.end(output);
          finish();
        } else if (event?.type === "response.failed" || event?.type === "error") {
          finish(new Error(formatOpenAiResponseError(event)));
        }
      } catch (error) {
        finish(error);
      }
    };

    client.on("message", onMessage);
    client.on("error", onError);
    client.on("close", onClose);
  });
}

function processResponseEvent(event, output, stream, model) {
  const type = event?.type;
  if (type === "response.created" && typeof event.response?.id === "string") {
    output.responseId = event.response.id;
    return;
  }
  if (type === "response.output_item.added") {
    const item = event.item;
    if (item?.type === "message") {
      const block = { type: "text", text: "" };
      output.content.push(block);
      stream.push({ type: "text_start", contentIndex: output.content.length - 1, partial: output });
    } else if (item?.type === "function_call") {
      const block = buildToolCallBlock(item);
      output.content.push(block);
      stream.push({
        type: "toolcall_start",
        contentIndex: output.content.length - 1,
        partial: output,
      });
    } else if (typeof item?.type === "string" && item.type.startsWith("reasoning")) {
      const block = { type: "thinking", thinking: "" };
      output.content.push(block);
      stream.push({
        type: "thinking_start",
        contentIndex: output.content.length - 1,
        partial: output,
      });
    }
    return;
  }
  if (type === "response.output_text.delta" || type === "response.refusal.delta") {
    const block = lastBlockOfType(output, "text");
    if (block) {
      const delta = stringify(event.delta);
      block.text += delta;
      stream.push({
        type: "text_delta",
        contentIndex: output.content.indexOf(block),
        delta,
        partial: output,
      });
    }
    return;
  }
  if (type === "response.function_call_arguments.delta") {
    const block = lastBlockOfType(output, "toolCall");
    if (block) {
      const delta = stringify(event.delta);
      block.partialJson = `${block.partialJson ?? ""}${delta}`;
      block.arguments = parseJsonObject(block.partialJson);
      stream.push({
        type: "toolcall_delta",
        contentIndex: output.content.indexOf(block),
        delta,
        partial: output,
      });
    }
    return;
  }
  if (type === "response.output_item.done") {
    const item = event.item;
    if (item?.type === "message") {
      const block = lastBlockOfType(output, "text");
      if (block) {
        block.text = extractMessageText(item);
        block.textSignature = encodeTextSignature(item.id);
        stream.push({
          type: "text_end",
          contentIndex: output.content.indexOf(block),
          content: block.text,
          partial: output,
        });
      }
    } else if (item?.type === "function_call") {
      const block = lastBlockOfType(output, "toolCall");
      if (block) {
        const toolCall = buildToolCallBlock(item, block.partialJson);
        Object.assign(block, toolCall);
        stream.push({
          type: "toolcall_end",
          contentIndex: output.content.indexOf(block),
          toolCall,
          partial: output,
        });
      }
    }
    return;
  }
  if (type === "response.completed") {
    if (typeof event.response?.id === "string") {
      output.responseId = event.response.id;
    }
    output.usage = normalizeUsage(event.response?.usage, model);
    output.stopReason = output.content.some((block) => block.type === "toolCall")
      ? "toolUse"
      : mapResponseStatus(event.response?.status);
  }
}

class AssistantMessageEventStream {
  constructor() {
    this.queue = [];
    this.waiting = [];
    this.done = false;
    this.finalResult = new Promise((resolve) => {
      this.resolveFinalResult = resolve;
    });
  }

  push(event) {
    if (this.done) {
      return;
    }
    if (event.type === "done") {
      this.done = true;
      this.resolveFinalResult(event.message);
    } else if (event.type === "error") {
      this.done = true;
      this.resolveFinalResult(event.error);
    }
    const waiter = this.waiting.shift();
    if (waiter) {
      waiter({ value: event, done: false });
      return;
    }
    this.queue.push(event);
  }

  end(result) {
    this.done = true;
    if (result) {
      this.resolveFinalResult(result);
    }
    while (this.waiting.length > 0) {
      this.waiting.shift()?.({ value: undefined, done: true });
    }
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift();
        continue;
      }
      if (this.done) {
        return;
      }
      const next = await new Promise((resolve) => this.waiting.push(resolve));
      if (next.done) {
        return;
      }
      yield next.value;
    }
  }

  result() {
    return this.finalResult;
  }
}

function buildAssistantMessage({ model, content, stopReason, usage, errorMessage }) {
  return {
    role: "assistant",
    content,
    api: model?.api,
    provider: model?.provider,
    model: model?.id,
    usage:
      usage ??
      {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    stopReason,
    timestamp: Date.now(),
    ...(errorMessage ? { errorMessage } : {}),
  };
}

function buildToolCallBlock(item, partialJson) {
  return {
    type: "toolCall",
    id: `${stringify(item.call_id)}|${stringify(item.id)}`,
    name: stringify(item.name),
    arguments: parseJsonObject(partialJson ?? stringify(item.arguments, "{}")),
    partialJson: partialJson ?? stringify(item.arguments),
  };
}

function normalizeUsage(usage, model) {
  const cacheRead = Number(usage?.input_tokens_details?.cached_tokens ?? 0);
  const input = Math.max(0, Number(usage?.input_tokens ?? 0) - cacheRead);
  const output = Number(usage?.output_tokens ?? 0);
  const totalTokens = Number(usage?.total_tokens ?? input + output + cacheRead);
  const cost = {
    input: costForTokens(input, model?.cost?.input),
    output: costForTokens(output, model?.cost?.output),
    cacheRead: costForTokens(cacheRead, model?.cost?.cacheRead),
    cacheWrite: 0,
    total: 0,
  };
  cost.total = cost.input + cost.output + cost.cacheRead + cost.cacheWrite;
  return { input, output, cacheRead, cacheWrite: 0, totalTokens, cost };
}

function costForTokens(tokens, perMillion) {
  return (Number(tokens) / 1_000_000) * Number(perMillion ?? 0);
}

function lastBlockOfType(output, type) {
  for (let index = output.content.length - 1; index >= 0; index -= 1) {
    if (output.content[index]?.type === type) {
      return output.content[index];
    }
  }
  return undefined;
}

function extractMessageText(item) {
  return Array.isArray(item.content)
    ? item.content
        .map((part) => stringify(part?.text ?? part?.refusal))
        .join("")
    : "";
}

function stringify(value, fallback = "") {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return fallback;
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function encodeTextSignature(id) {
  return JSON.stringify({ v: 1, id: stringify(id) });
}

function mapResponseStatus(status) {
  if (status === "incomplete") {
    return "length";
  }
  if (status === "failed" || status === "cancelled") {
    return "error";
  }
  return "stop";
}

function formatOpenAiResponseError(event) {
  const error = event?.error ?? event?.response?.error;
  return (
    error?.message ??
    event?.response?.incomplete_details?.reason ??
    event?.message ??
    "OpenAI proxy WebSocket response failed."
  );
}

function safeUrlHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

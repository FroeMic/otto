import {
  buildOpenAiProxyModel,
  isOpenAiProxyModernModel,
  isOpenAiProxyXHighModel,
  OPENAI_PROXY_PROVIDER_ID,
} from "./model-catalog.js";
import {
  createOpenAiProxyDiagnostics,
  summarizeExtraParams,
  summarizeReplayPolicy,
  summarizeResolvedModel,
  summarizeRuntimeAuth,
  summarizeTransportNormalization,
  summarizeTransportTurnState,
  summarizeWebSocketSessionPolicy,
} from "./diagnostics.js";
import { buildOpenAiProxyReplayPolicy } from "./replay-policy.js";
import { createOpenAiProxyWebSocketStreamFn } from "./responses-websocket.js";
import { resolveOpenAiProxyRuntimeAuth } from "./runtime-auth.js";
import { resolveOpenAiProxyTransport } from "./transport.js";
import {
  normalizeOpenAiProxyResolvedModel,
  normalizeOpenAiProxyTransport,
  prepareOpenAiProxyExtraParams,
  resolveOpenAiProxyTransportTurnState,
  resolveOpenAiProxyWebSocketSessionPolicy,
} from "./transport-policy.js";

export { OPENAI_PROXY_PROVIDER_ID };

const RECENT_EVENT_SHAPE_LIMIT = 12;

export function buildOpenAiProxyProvider(dependencies = {}) {
  const diagnostics = createOpenAiProxyDiagnostics(dependencies.logger);
  const streamHooks =
    dependencies.openAiResponsesStreamHooks ??
    buildLocalOpenAiResponsesStreamHooks();
  const instrumentedStreamHooks = instrumentOpenAiResponsesStreamHooks(
    streamHooks,
    diagnostics,
    dependencies.createWebSocketStreamFn ?? createOpenAiProxyWebSocketStreamFn,
  );

  diagnostics.debug("provider initialized", {
    providerId: OPENAI_PROXY_PROVIDER_ID,
    defaultModel: `${OPENAI_PROXY_PROVIDER_ID}/gpt-5.4`,
    hasInjectedStreamHooks: Boolean(dependencies.openAiResponsesStreamHooks),
  });

  return {
    id: OPENAI_PROXY_PROVIDER_ID,
    label: "OpenAI Proxy",
    docsPath: "/providers/models",
    auth: [
      {
        methodId: "api-key",
        label: "Otto tenant token",
        hint: "Tenant-scoped Otto runtime token for Otto-managed provider proxying",
        optionKey: "tenantToken",
        flagName: "--tenant-token",
        envVar: "TENANT_TOKEN",
        promptMessage: "Enter TENANT_TOKEN",
        defaultModel: `${OPENAI_PROXY_PROVIDER_ID}/gpt-5.4`,
        wizard: false,
      },
    ],
    catalog: {
      buildProvider: () => ({
        api: "openai-responses",
        models: [],
      }),
    },
    resolveDynamicModel: (ctx) => buildOpenAiProxyModel(ctx.modelId),
    normalizeResolvedModel: (ctx) => {
      const resolved = normalizeOpenAiProxyResolvedModel(ctx);
      diagnostics.debug(
        "resolved model normalized",
        summarizeResolvedModel(ctx, resolved),
      );
      return resolved;
    },
    normalizeTransport: (ctx) => {
      const resolved = normalizeOpenAiProxyTransport(ctx);
      diagnostics.debug(
        "transport normalized",
        summarizeTransportNormalization(ctx, resolved),
      );
      return resolved;
    },
    buildReplayPolicy: (ctx) => {
      const resolved = buildOpenAiProxyReplayPolicy(ctx);
      diagnostics.debug("replay policy resolved", summarizeReplayPolicy(ctx, resolved));
      return resolved;
    },
    prepareExtraParams: (ctx) => {
      const resolved = prepareOpenAiProxyExtraParams(ctx);
      diagnostics.debug("extra params prepared", summarizeExtraParams(ctx, resolved));
      return resolved;
    },
    ...instrumentedStreamHooks,
    resolveTransportTurnState: (ctx) => {
      const resolved = resolveOpenAiProxyTransportTurnState(ctx);
      diagnostics.debug(
        "transport turn state resolved",
        summarizeTransportTurnState(ctx, resolved),
      );
      return resolved;
    },
    resolveWebSocketSessionPolicy: (ctx) => {
      const resolved = resolveOpenAiProxyWebSocketSessionPolicy(ctx);
      diagnostics.debug(
        "websocket session policy resolved",
        summarizeWebSocketSessionPolicy(ctx, resolved),
      );
      return resolved;
    },
    resolveReasoningOutputMode: () => "native",
    prepareRuntimeAuth: async (ctx) => {
      const resolved = resolveOpenAiProxyRuntimeAuth(ctx);
      diagnostics.debug("runtime auth resolved", summarizeRuntimeAuth(ctx, resolved));
      return resolved;
    },
    supportsXHighThinking: ({ modelId }) => isOpenAiProxyXHighModel(modelId),
    isModernModelRef: ({ modelId }) => isOpenAiProxyModernModel(modelId),
  };
}

function instrumentOpenAiResponsesStreamHooks(
  streamHooks,
  diagnostics,
  createWebSocketStreamFn,
) {
  if (typeof streamHooks?.wrapStreamFn !== "function") {
    return streamHooks;
  }

  return {
    ...streamHooks,
    wrapStreamFn: (ctx) => {
      diagnostics.debug("stream hook invoked", {
        provider: ctx?.provider,
        modelId: ctx?.modelId,
        transport: ctx?.transport,
        sessionId: ctx?.sessionId,
        turnId: ctx?.turnId,
        attempt: ctx?.attempt,
        hasStreamFn: typeof ctx?.streamFn === "function",
      });
      const wrappedStreamFn = streamHooks.wrapStreamFn(ctx);
      if (typeof wrappedStreamFn !== "function") {
        return wrappedStreamFn;
      }

      return async (model, context, options) => {
        const startedAt = Date.now();
        const resolvedTransport = resolveOpenAiProxyTransport();
        const signal = options?.signal;
        const fields = () => ({
          attempt: ctx?.attempt,
          durationMs: Date.now() - startedAt,
          hasAbortSignal: Boolean(signal),
          modelApi: model?.api,
          modelId: ctx?.modelId ?? model?.id,
          provider: ctx?.provider ?? model?.provider,
          sessionId: ctx?.sessionId,
          signalAborted: Boolean(signal?.aborted),
          transport: resolvedTransport.transport,
          turnId: ctx?.turnId,
        });
        const abortListener = () => {
          diagnostics.warn("stream function abort signal received", {
            ...fields(),
            abortReason: formatDiagnosticReason(signal?.reason),
          });
        };

        diagnostics.debug("stream function starting", fields());

        if (signal) {
          if (signal.aborted) {
            abortListener();
          } else {
            signal.addEventListener("abort", abortListener, { once: true });
          }
        }

        try {
          diagnostics.debug("transport resolved", {
            provider: ctx?.provider ?? model?.provider,
            modelId: ctx?.modelId ?? model?.id,
            transport: resolvedTransport.transport,
            source: resolvedTransport.source,
          });
          const transportOptions = {
            ...options,
            transport: resolvedTransport.transport,
          };
          const streamFn =
            resolvedTransport.transport === "websocket"
              ? createWebSocketStreamFn(wrappedStreamFn, diagnostics)
              : wrappedStreamFn;
          const result = await streamFn(model, context, transportOptions);
          diagnostics.debug("stream function completed", fields());
          return instrumentReturnedStream(result, diagnostics, fields);
        } catch (error) {
          diagnostics.error("stream function failed", {
            ...fields(),
            error: getDiagnosticErrorMessage(error),
            errorName: getDiagnosticErrorName(error),
          });
          throw error;
        } finally {
          signal?.removeEventListener?.("abort", abortListener);
        }
      };
    },
  };
}

function instrumentReturnedStream(result, diagnostics, baseFields) {
  if (!isAsyncIterable(result)) {
    return result;
  }

  const sourceIteratorFactory = result[Symbol.asyncIterator].bind(result);
  const startedAt = Date.now();
  const state = {
    eventTypeCounts: {},
    events: 0,
    firstEventType: undefined,
    lastEventType: undefined,
    recentEventShapes: [],
    terminalEventType: undefined,
  };

  const fields = () => ({
    ...baseFields(),
    durationMs: Date.now() - startedAt,
    events: state.events,
    eventTypeCounts:
      Object.keys(state.eventTypeCounts).length > 0
        ? state.eventTypeCounts
        : undefined,
    firstEventType: state.firstEventType,
    lastEventType: state.lastEventType,
    recentEventShapes:
      state.recentEventShapes.length > 0 ? state.recentEventShapes : undefined,
    terminalEventType: state.terminalEventType,
  });

  async function* instrumentedIterator() {
    let completed = false;
    let failed = false;
    const sourceIterator = sourceIteratorFactory();

    diagnostics.debug("stream iteration started", fields());

    try {
      while (true) {
        const next = await sourceIterator.next();

        if (next.done) {
          break;
        }

        const event = next.value;
        const eventType = recordStreamEvent(state, event);
        if (eventType === "error") {
          diagnostics.error("stream yielded error event", {
            ...fields(),
            ...summarizeConciseStreamErrorEvent(event),
          });
          diagnostics.debug("stream yielded error event details", {
            ...fields(),
            ...summarizeStreamErrorEvent(event),
          });
        }
        yield event;
      }

      completed = true;
      diagnostics.debug("stream iteration completed", fields());
    } catch (error) {
      failed = true;
      diagnostics.error("stream iteration failed", {
        ...fields(),
        error: getDiagnosticErrorMessage(error),
        errorName: getDiagnosticErrorName(error),
      });
      throw error;
    } finally {
      if (!completed && !failed) {
        await sourceIterator.return?.();
        const logStreamClosedEarly =
          isSuccessfulTerminalStreamEvent(state.lastEventType)
            ? diagnostics.debug
            : diagnostics.warn;
        logStreamClosedEarly("stream iteration closed early", fields());
      }
    }
  }

  return new Proxy(result, {
    get(target, property, receiver) {
      if (property === Symbol.asyncIterator) {
        return instrumentedIterator;
      }

      return Reflect.get(target, property, receiver);
    },
  });
}

function isAsyncIterable(value) {
  return Boolean(value && typeof value[Symbol.asyncIterator] === "function");
}

function recordStreamEvent(state, event) {
  const eventType = resolveStreamEventType(event);
  state.events += 1;
  state.recentEventShapes.push(summarizeStreamEventShape(event, state.events));
  if (state.recentEventShapes.length > RECENT_EVENT_SHAPE_LIMIT) {
    state.recentEventShapes.shift();
  }

  if (eventType) {
    state.firstEventType ??= eventType;
    state.lastEventType = eventType;
    state.eventTypeCounts[eventType] = (state.eventTypeCounts[eventType] ?? 0) + 1;

    if (isTerminalOpenAiResponsesEvent(eventType)) {
      state.terminalEventType = eventType;
    }
  }

  return eventType;
}

function resolveStreamEventType(event) {
  const type =
    typeof event?.type === "string"
      ? event.type
      : typeof event?.event === "string"
        ? event.event
        : undefined;
  const normalized = type?.trim();

  return normalized ? normalized : undefined;
}

function isTerminalOpenAiResponsesEvent(eventType) {
  return (
    eventType === "response.completed" ||
    eventType === "response.failed" ||
    eventType === "done" ||
    eventType === "error"
  );
}

function isSuccessfulTerminalStreamEvent(eventType) {
  return eventType === "response.completed" || eventType === "done";
}

function buildLocalOpenAiResponsesStreamHooks() {
  return {
    wrapStreamFn: (ctx) => ctx?.streamFn,
  };
}

function getDiagnosticErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function getDiagnosticErrorName(error) {
  return error instanceof Error ? error.name : typeof error;
}

function formatDiagnosticReason(reason) {
  if (reason === undefined) {
    return null;
  }
  return typeof reason === "string" ? reason : getDiagnosticErrorMessage(reason);
}

function summarizeStreamErrorEvent(event) {
  const error = event?.error ?? event;
  const cause = error?.cause;
  const errorContent = error?.content;

  return {
    eventType: resolveStreamEventType(event),
    eventKeys: summarizeObjectKeys(event),
    eventReason: event?.reason,
    eventError: event?.error,
    eventErrorContentKind: summarizeDiagnosticContentKind(errorContent),
    eventErrorContentLength: summarizeDiagnosticContentLength(errorContent),
    eventErrorContentPreview: summarizeDiagnosticContent(errorContent),
    eventErrorContentPreviewTruncated:
      Array.isArray(errorContent) && errorContent.length > 8 ? true : undefined,
    eventErrorName: summarizeDiagnosticValue(error?.name),
    eventErrorMessage: summarizeDiagnosticValue(error?.message),
    eventErrorCode: summarizeDiagnosticValue(error?.code),
    eventErrorType: summarizeDiagnosticValue(error?.type),
    eventErrorCauseName: summarizeDiagnosticValue(cause?.name),
    eventErrorCauseMessage: summarizeDiagnosticValue(cause?.message),
    eventErrorCauseCode: summarizeDiagnosticValue(cause?.code),
  };
}

function summarizeConciseStreamErrorEvent(event) {
  const error = event?.error ?? event;
  const cause = error?.cause;

  return {
    eventType: resolveStreamEventType(event),
    eventKeys: summarizeObjectKeys(event),
    eventReason: event?.reason,
    eventErrorName: summarizeDiagnosticValue(error?.name),
    eventErrorMessage: summarizeDiagnosticValue(
      error?.errorMessage ?? error?.message,
    ),
    eventErrorCode: summarizeDiagnosticValue(error?.code),
    eventErrorType: summarizeDiagnosticValue(error?.type),
    eventErrorCauseName: summarizeDiagnosticValue(cause?.name),
    eventErrorCauseMessage: summarizeDiagnosticValue(cause?.message),
    eventErrorCauseCode: summarizeDiagnosticValue(cause?.code),
  };
}

function summarizeStreamEventShape(event, sequence) {
  const error = event?.error;
  const output = event?.output ?? event?.item ?? event?.response;
  const content =
    event?.content ??
    event?.delta ??
    event?.part ??
    event?.item?.content ??
    event?.response?.output;
  const errorContent = error?.content;

  return {
    sequence,
    eventType: resolveStreamEventType(event),
    valueKind: summarizeDiagnosticValueKind(event),
    keys: summarizeObjectKeys(event),
    fieldKinds: summarizeObjectFieldKinds(event),
    outputKeys: summarizeObjectKeys(output),
    outputFieldKinds: summarizeObjectFieldKinds(output),
    contentKind: summarizeDiagnosticContentKind(content),
    contentLength: summarizeDiagnosticContentLength(content),
    contentItemShapes: summarizeDiagnosticArrayItemShapes(content),
    errorKind: summarizeDiagnosticValueKind(error),
    errorKeys: summarizeObjectKeys(error),
    errorFieldKinds: summarizeObjectFieldKinds(error),
    errorContentKind: summarizeDiagnosticContentKind(errorContent),
    errorContentLength: summarizeDiagnosticContentLength(errorContent),
    errorContentItemShapes: summarizeDiagnosticArrayItemShapes(errorContent),
    responseIdPresent: Boolean(
      event?.responseId ??
        event?.response_id ??
        event?.response?.id ??
        error?.responseId ??
        error?.response_id,
    ),
  };
}

function summarizeObjectKeys(value) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return Object.keys(value).sort().slice(0, 20);
}

function summarizeObjectFieldKinds(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .slice(0, 24)
      .map((key) => [key, summarizeDiagnosticValueKind(value[key])]),
  );
}

function summarizeDiagnosticArrayItemShapes(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.slice(0, 4).map((item) => ({
    keys: summarizeObjectKeys(item),
    fieldKinds: summarizeObjectFieldKinds(item),
    textKind: summarizeDiagnosticValueKind(item?.text),
    textLength: typeof item?.text === "string" ? item.text.length : undefined,
    type: summarizeDiagnosticValue(item?.type),
  }));
}

function summarizeDiagnosticValueKind(value) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function summarizeDiagnosticValue(value) {
  if (value == null) {
    return undefined;
  }

  const text = typeof value === "string" ? value : String(value);
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
}

function summarizeDiagnosticContent(value, depth = 0) {
  if (value == null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 8)
      .map((item) => summarizeDiagnosticContent(item, depth + 1));
  }

  if (typeof value !== "object") {
    return summarizeDiagnosticValue(value);
  }

  if (depth >= 4) {
    return summarizeDiagnosticValue(value);
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, 24)
      .map(([key, item]) => [
        key,
        isSensitiveDiagnosticKey(key)
          ? "[redacted]"
          : summarizeDiagnosticContent(item, depth + 1),
      ]),
  );
}

function summarizeDiagnosticContentKind(value) {
  if (value == null) {
    return undefined;
  }

  return Array.isArray(value) ? "array" : typeof value;
}

function summarizeDiagnosticContentLength(value) {
  if (Array.isArray(value) || typeof value === "string") {
    return value.length;
  }

  return undefined;
}

function isSensitiveDiagnosticKey(key) {
  return /authorization|api[-_]?key|secret|token|password/i.test(key);
}

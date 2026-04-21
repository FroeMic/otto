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
import { resolveOpenAiProxyRuntimeAuth } from "./runtime-auth.js";
import {
  normalizeOpenAiProxyResolvedModel,
  normalizeOpenAiProxyTransport,
  prepareOpenAiProxyExtraParams,
  resolveOpenAiProxyTransportTurnState,
  resolveOpenAiProxyWebSocketSessionPolicy,
} from "./transport-policy.js";

export { OPENAI_PROXY_PROVIDER_ID };

export function buildOpenAiProxyProvider(dependencies = {}) {
  const diagnostics = createOpenAiProxyDiagnostics(dependencies.logger);
  const streamHooks =
    dependencies.openAiResponsesStreamHooks ??
    buildLocalOpenAiResponsesStreamHooks();
  const instrumentedStreamHooks = instrumentOpenAiResponsesStreamHooks(
    streamHooks,
    diagnostics,
  );

  diagnostics.info("provider initialized", {
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
      diagnostics.info(
        "resolved model normalized",
        summarizeResolvedModel(ctx, resolved),
      );
      return resolved;
    },
    normalizeTransport: (ctx) => {
      const resolved = normalizeOpenAiProxyTransport(ctx);
      diagnostics.info(
        "transport normalized",
        summarizeTransportNormalization(ctx, resolved),
      );
      return resolved;
    },
    buildReplayPolicy: (ctx) => {
      const resolved = buildOpenAiProxyReplayPolicy(ctx);
      diagnostics.info("replay policy resolved", summarizeReplayPolicy(ctx, resolved));
      return resolved;
    },
    prepareExtraParams: (ctx) => {
      const resolved = prepareOpenAiProxyExtraParams(ctx);
      diagnostics.info("extra params prepared", summarizeExtraParams(ctx, resolved));
      return resolved;
    },
    ...instrumentedStreamHooks,
    resolveTransportTurnState: (ctx) => {
      const resolved = resolveOpenAiProxyTransportTurnState(ctx);
      diagnostics.info(
        "transport turn state resolved",
        summarizeTransportTurnState(ctx, resolved),
      );
      return resolved;
    },
    resolveWebSocketSessionPolicy: (ctx) => {
      const resolved = resolveOpenAiProxyWebSocketSessionPolicy(ctx);
      diagnostics.info(
        "websocket session policy resolved",
        summarizeWebSocketSessionPolicy(ctx, resolved),
      );
      return resolved;
    },
    resolveReasoningOutputMode: () => "native",
    prepareRuntimeAuth: async (ctx) => {
      const resolved = resolveOpenAiProxyRuntimeAuth(ctx);
      diagnostics.info("runtime auth resolved", summarizeRuntimeAuth(ctx, resolved));
      return resolved;
    },
    supportsXHighThinking: ({ modelId }) => isOpenAiProxyXHighModel(modelId),
    isModernModelRef: ({ modelId }) => isOpenAiProxyModernModel(modelId),
  };
}

function instrumentOpenAiResponsesStreamHooks(streamHooks, diagnostics) {
  if (typeof streamHooks?.wrapStreamFn !== "function") {
    return streamHooks;
  }

  return {
    ...streamHooks,
    wrapStreamFn: (ctx) => {
      diagnostics.info("stream hook invoked", {
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
          transport: options?.transport ?? ctx?.transport,
          turnId: ctx?.turnId,
        });
        const abortListener = () => {
          diagnostics.warn("stream function abort signal received", {
            ...fields(),
            abortReason: formatDiagnosticReason(signal?.reason),
          });
        };

        diagnostics.info("stream function starting", fields());

        if (signal) {
          if (signal.aborted) {
            abortListener();
          } else {
            signal.addEventListener("abort", abortListener, { once: true });
          }
        }

        try {
          const result = await wrappedStreamFn(model, context, options);
          diagnostics.info("stream function completed", fields());
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
    events: 0,
    firstEventType: undefined,
    lastEventType: undefined,
    terminalEventType: undefined,
  };

  const fields = () => ({
    ...baseFields(),
    durationMs: Date.now() - startedAt,
    events: state.events,
    firstEventType: state.firstEventType,
    lastEventType: state.lastEventType,
    terminalEventType: state.terminalEventType,
  });

  async function* instrumentedIterator() {
    let completed = false;
    let failed = false;
    const sourceIterator = sourceIteratorFactory();

    diagnostics.info("stream iteration started", fields());

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
            ...summarizeStreamErrorEvent(event),
          });
        }
        yield event;
      }

      completed = true;
      diagnostics.info("stream iteration completed", fields());
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
        diagnostics.warn("stream iteration closed early", fields());
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

  if (eventType) {
    state.firstEventType ??= eventType;
    state.lastEventType = eventType;

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
    eventType === "error"
  );
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

  return {
    eventType: resolveStreamEventType(event),
    eventKeys: summarizeObjectKeys(event),
    eventErrorName: summarizeDiagnosticValue(error?.name),
    eventErrorMessage: summarizeDiagnosticValue(error?.message),
    eventErrorCode: summarizeDiagnosticValue(error?.code),
    eventErrorType: summarizeDiagnosticValue(error?.type),
    eventErrorCauseName: summarizeDiagnosticValue(cause?.name),
    eventErrorCauseMessage: summarizeDiagnosticValue(cause?.message),
    eventErrorCauseCode: summarizeDiagnosticValue(cause?.code),
  };
}

function summarizeObjectKeys(value) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return Object.keys(value).sort().slice(0, 20);
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

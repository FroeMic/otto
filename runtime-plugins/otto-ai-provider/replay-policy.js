export function buildOpenAiProxyReplayPolicy(ctx) {
  const basePolicy = {
    sanitizeMode: "images-only",
    applyAssistantFirstOrderingFix: false,
    validateGeminiTurns: false,
    validateAnthropicTurns: false,
  };

  if (ctx?.modelApi === "openai-completions") {
    return {
      ...basePolicy,
      sanitizeToolCallIds: true,
      toolCallIdMode: "strict",
    };
  }

  return {
    ...basePolicy,
    sanitizeToolCallIds: false,
  };
}

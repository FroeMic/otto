import "dotenv/config";

const runtimeKey = process.env.RUNTIME_OPENAI_API_KEY;
const runtimeModel = process.env.RUNTIME_MODEL_PRIMARY || "openai/gpt-5.4";

if (!runtimeKey) {
  console.error("RUNTIME_OPENAI_API_KEY is missing.");
  process.exit(1);
}

const model = normalizeOpenAiModel(runtimeModel);

if (!model) {
  console.error(
    `RUNTIME_MODEL_PRIMARY must be an openai/* model for this smoke test. Received: ${runtimeModel}`,
  );
  process.exit(1);
}

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${runtimeKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    input: "Reply with exactly PONG.",
    max_output_tokens: 32,
    model,
  }),
});

const body = await response.json();

if (!response.ok) {
  console.error(`OpenAI request failed: HTTP ${response.status}`);

  if (body?.error) {
    console.error(`type=${body.error.type ?? "unknown"}`);
    console.error(`code=${body.error.code ?? "unknown"}`);
    console.error(body.error.message ?? "No error message returned.");
  } else {
    console.error(JSON.stringify(body, null, 2));
  }

  process.exit(1);
}

const text = extractText(body);

console.info("OpenAI request succeeded.");
console.info(`model=${body.model ?? model}`);
console.info(`status=${body.status ?? "unknown"}`);
console.info(`output=${text || "<no text returned>"}`);

function normalizeOpenAiModel(value) {
  if (value.startsWith("openai/")) {
    return value.slice("openai/".length);
  }

  if (!value.includes("/")) {
    return value;
  }

  return null;
}

function extractText(body) {
  const outputs = Array.isArray(body?.output) ? body.output : [];

  for (const item of outputs) {
    const parts = Array.isArray(item?.content) ? item.content : [];

    for (const part of parts) {
      if (part?.type === "output_text" && part?.text) {
        return part.text;
      }
    }
  }

  return "";
}

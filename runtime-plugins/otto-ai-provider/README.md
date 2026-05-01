# otto-ai-provider

An OpenClaw plugin that replaces the standard OpenAI provider with a proxied variant. Instead of the runtime holding an OpenAI API key, it holds only a short-lived bearer token issued by the control plane. All LLM calls are routed through the control plane's API, which holds the OpenAI credentials and applies usage metering.

## How It Works

1. Registered in OpenClaw as provider ID `openai-proxy`
2. At inference time, the runtime sends the request to the control plane's OpenAI proxy endpoint, authenticated with the tenant bearer token
3. The control plane forwards to OpenAI, records token usage, and returns the response

Supports both text generation and audio transcription (`mediaUnderstandingProviders`).

## Security

A compromised tenant VPS exposes a short-lived bearer token — not an OpenAI API key. Credential rotation happens centrally in the control plane without touching tenant servers.

## Plugin Manifest

```json
{
  "providers": ["openai-proxy"],
  "contracts": {
    "mediaUnderstandingProviders": ["openai-proxy"]
  }
}
```

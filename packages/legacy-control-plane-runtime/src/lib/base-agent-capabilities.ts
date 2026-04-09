import type { AgentCapability } from "./agent-capabilities";

/**
 * Capabilities always available to the agent regardless of which
 * integrations are installed. Built into the OpenClaw runtime.
 */
export const baseAgentCapabilities: AgentCapability[] = [
  {
    description: "Read files from the workspace filesystem.",
    direction: "tool",
    key: "base:tool:read",
    label: "Read files",
    openclawTool: "read",
    source: "base",
  },
  {
    description: "Create or overwrite files in the workspace.",
    direction: "tool",
    key: "base:tool:write",
    label: "Write files",
    openclawTool: "write",
    source: "base",
  },
  {
    description: "Make targeted search-and-replace edits to existing files.",
    direction: "tool",
    key: "base:tool:edit",
    label: "Edit files",
    openclawTool: "edit",
    source: "base",
  },
  {
    description: "Run shell commands in the workspace environment.",
    direction: "tool",
    key: "base:tool:exec",
    label: "Execute commands",
    openclawTool: "exec",
    source: "base",
  },
  {
    description: "Create and manage recurring scheduled tasks.",
    direction: "tool",
    key: "base:tool:cron",
    label: "Schedule tasks",
    openclawTool: "cron",
    source: "base",
  },
  {
    description: "Spawn, list, and communicate with sub-agent sessions.",
    direction: "tool",
    key: "base:tool:sessions",
    label: "Multi-agent sessions",
    openclawTool: "sessions_spawn",
    source: "base",
  },
  {
    description: "Examine and describe image files.",
    direction: "tool",
    key: "base:tool:image",
    label: "Analyze images",
    openclawTool: "image",
    source: "base",
  },
  {
    description: "Generate images from text descriptions.",
    direction: "tool",
    key: "base:tool:image-generate",
    label: "Generate images",
    openclawTool: "image_generate",
    source: "base",
  },
  {
    description: "Read and analyze PDF documents.",
    direction: "tool",
    key: "base:tool:pdf",
    label: "Analyze PDFs",
    openclawTool: "pdf",
    source: "base",
  },
  {
    description: "Convert text to spoken audio.",
    direction: "tool",
    key: "base:tool:tts",
    label: "Text to speech",
    openclawTool: "tts",
    source: "base",
  },
];

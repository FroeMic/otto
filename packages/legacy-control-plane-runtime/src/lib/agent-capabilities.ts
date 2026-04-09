export type AgentCapabilityDirection = "trigger" | "tool" | "read";
export type AgentCapabilitySource = "base" | "integration" | "conditional";

export type AgentCapability = {
  conditionNote?: string;
  description: string;
  direction: AgentCapabilityDirection;
  key: string;
  label: string;
  openclawTool?: string;
  source: AgentCapabilitySource;
  userControllable?: boolean;
};

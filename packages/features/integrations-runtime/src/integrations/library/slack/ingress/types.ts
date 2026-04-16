export type SlackIngressRequestType = "commands" | "events" | "interactivity";

export type ForwardedSlackIngressResponse = {
  body: string;
  headers: Record<string, string>;
  status: number;
};

export type ForwardSlackIngressForTeam = (input: {
  body: string;
  enterpriseId?: string | null;
  headers: Record<string, string>;
  requestPath: string;
  requestType: SlackIngressRequestType;
  teamId: string;
}) => Promise<ForwardedSlackIngressResponse>;

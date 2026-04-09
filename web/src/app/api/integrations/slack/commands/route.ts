import { handleSlackIngressRoute } from "@/lib/slack-ingress-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return await handleSlackIngressRoute(request, "commands");
}

import { createServer, type IncomingMessage } from "node:http";

import { handleIntegrationGatewayRequest } from "@/integration-gateway/handler";
import { getEnv } from "@/lib/env";

const port = getEnv().INTEGRATION_GATEWAY_PORT;

async function toRequest(req: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : Buffer.concat(chunks);

  return new Request(`http://127.0.0.1:${port}${req.url ?? "/"}`, {
    body,
    headers: new Headers(req.headers as Record<string, string>),
    method: req.method ?? "GET",
  });
}

const server = createServer(async (req, res) => {
  const request = await toRequest(req);
  const response = await handleIntegrationGatewayRequest(request);
  const responseBody = Buffer.from(await response.arrayBuffer());

  res.statusCode = response.status;

  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  res.end(responseBody);
});

server.listen(port, "0.0.0.0", () => {
  console.info(`[integration-gateway] starting on :${port}`);
});

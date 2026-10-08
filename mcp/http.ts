#!/usr/bin/env node
// Remote entry point for hosted agents (runs on the exe.dev VM): `node mcp/http.ts`.
// Serves MCP over Streamable HTTP at /mcp, gated by `Authorization: Bearer $SITE_MCP_TOKEN`.
import { createServer, type IncomingMessage } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { configFromEnv, createSiteServer } from "./server.ts";

const secret = process.env.SITE_MCP_TOKEN;
const config = configFromEnv(process.env);
if (!secret || !config) {
  console.error("rohanth-site MCP: set SITE_MCP_TOKEN and either GITHUB_TOKEN or GITHUB_API_URL.");
  process.exit(1);
}
const port = Number(process.env.PORT || 8000);

function authorized(header: string | undefined): boolean {
  const given = Buffer.from(header?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "");
  const expected = Buffer.from(secret!);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://${req.headers.host ?? "localhost"}${req.url}`, { method: req.method, headers, body });
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", ...headers }).end(JSON.stringify(body));
  };

  if (path === "/health") return send(200, { ok: true, repo: `${config.owner}/${config.repo}`, branch: config.branch });
  if (path !== "/mcp") return send(404, { error: "not found. The MCP endpoint is /mcp." });
  if (!authorized(req.headers.authorization)) return send(401, { error: "unauthorized" }, { "WWW-Authenticate": "Bearer" });
  // Stateless server: no server-initiated SSE stream (GET) or sessions to end (DELETE).
  if (req.method !== "POST") return send(405, { error: "method not allowed" }, { Allow: "POST" });

  try {
    // A fresh server and transport per request, so restarts never strand a session.
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await createSiteServer(config).connect(transport);
    const response = await transport.handleRequest(await toRequest(req));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) return res.end();
    for await (const chunk of response.body) res.write(chunk);
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(500, { jsonrpc: "2.0", error: { code: -32603, message: "internal error" }, id: null });
  }
}).listen(port, () => console.log(`rohanth-site MCP listening on :${port}/mcp`));

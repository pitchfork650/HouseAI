/**
 * Reference MCP server for the OpenSwarm host (runs on the Windows host laptop).
 * Implements docs/openswarm-mcp-contract.md: tools `health` and `run_agent`,
 * Streamable HTTP on /mcp, bearer-token auth.
 *
 *   HOST_MODE=replay   (default) answers with the sample outputs, for testing the link
 *   HOST_MODE=openswarm          hands each agent to OpenSwarm: implement runOnOpenSwarm()
 *
 * Start:  npm run host:dev        (PORT=8787, OPENSWARM_TOKEN=dev-token by default)
 * Expose: cloudflared tunnel --url http://localhost:8787
 */
import http from "node:http";
import os from "node:os";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { replayOutput } from "../src/lib/swarm/replay";

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.OPENSWARM_TOKEN ?? "dev-token";
const MODE = process.env.HOST_MODE ?? "replay";

type RunAgentArgs = {
  runId: string;
  agent: { name: string; slug: string; version: string; prompt: string; outputSchema: Record<string, unknown> };
  context: Record<string, unknown>;
  images: { mimeType: string; dataBase64: string }[];
  timeoutMs: number;
};

/**
 * TODO(host team): send the agent to OpenSwarm and return its JSON output.
 * Use agent.prompt as the agent's instructions, agent.outputSchema as the required
 * output format, and pass context + images. Don't store images after the run.
 */
async function runOnOpenSwarm(_args: RunAgentArgs): Promise<{ output: unknown; model: string }> {
  throw new Error("runOnOpenSwarm() is not implemented yet on this host");
}

/** TODO(host team): report whether the OpenSwarm desktop app is running and signed in. */
async function openSwarmState(): Promise<{ running: boolean; signedIn: boolean; version?: string }> {
  if (MODE === "replay") return { running: true, signedIn: true, version: "replay" };
  return { running: false, signedIn: false };
}

function buildServer() {
  const server = new McpServer({ name: "houseai-openswarm-host", version: "0.1.0" });

  server.registerTool(
    "health",
    { description: "Read-only: is the host up and is OpenSwarm running and signed in?", annotations: { readOnlyHint: true } },
    async () => {
      const state = await openSwarmState();
      const body = { ok: true, openswarm: state, host: os.hostname(), mode: MODE };
      return { content: [{ type: "text", text: JSON.stringify(body) }], structuredContent: body };
    },
  );

  server.registerTool(
    "run_agent",
    {
      description: "Run one HouseAI agent on OpenSwarm. The agent definition (prompt + output schema) comes with each call.",
      inputSchema: {
        runId: z.string(),
        agent: z.object({ name: z.string(), slug: z.string(), version: z.string(), prompt: z.string(), outputSchema: z.record(z.string(), z.unknown()) }),
        context: z.record(z.string(), z.unknown()),
        images: z.array(z.object({ mimeType: z.string(), dataBase64: z.string() })).default([]),
        timeoutMs: z.number().default(180_000),
      },
    },
    async (args) => {
      const a = args as RunAgentArgs;
      const t0 = Date.now();
      try {
        const res = MODE === "replay" ? { output: replayOutput(a.agent.slug, a.context), model: "replay" } : await runOnOpenSwarm(a);
        const body = { ...res, logs: [{ t: new Date().toISOString(), text: `${a.agent.name} ${a.agent.version} done in ${Date.now() - t0} ms` }] };
        console.log(`[run_agent] ${a.runId} ${a.agent.slug}@${a.agent.version} images=${a.images.length} ok`);
        return { content: [{ type: "text", text: JSON.stringify(body) }], structuredContent: body };
      } catch (e) {
        console.log(`[run_agent] ${a.runId} ${a.agent.slug} failed: ${e instanceof Error ? e.message : e}`);
        return { isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] };
      }
    },
  );
  return server;
}

const httpServer = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/mcp")) {
    res.writeHead(404).end();
    return;
  }
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  // Stateless: a fresh server + transport per request.
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    await transport.handleRequest(req, res, body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500).end();
  }
});

httpServer.listen(PORT, () => console.log(`OpenSwarm MCP host (${MODE}) on http://localhost:${PORT}/mcp`));

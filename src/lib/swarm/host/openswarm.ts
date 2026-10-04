import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ImagePart } from "../../llm";
import type { AgentDefinition, HostResult, HostStatus, SwarmHost } from "./index";

/**
 * The OpenSwarm host: a separate device running OpenSwarm, reached through the team's
 * MCP server (see docs/openswarm-mcp-contract.md) over HTTPS or a private tunnel.
 */
export class OpenSwarmHost implements SwarmHost {
  kind = "openswarm" as const;
  private cached: { at: number; status: HostStatus } | null = null;

  constructor(private baseUrl: URL, private token: string) {}

  private endpoint(): URL {
    const u = new URL(this.baseUrl);
    if (!u.pathname.endsWith("/mcp")) u.pathname = u.pathname.replace(/\/$/, "") + "/mcp";
    return u;
  }

  private async withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
    const transport = new StreamableHTTPClientTransport(this.endpoint(), {
      requestInit: { headers: this.token ? { authorization: `Bearer ${this.token}` } : {} },
    });
    const client = new Client({ name: "houseai-dental", version: "0.1.0" });
    await client.connect(transport);
    try {
      return await fn(client);
    } finally {
      await client.close().catch(() => {});
    }
  }

  async invoke(def: AgentDefinition, req: { context: Record<string, unknown>; images?: ImagePart[]; signal?: AbortSignal; runId?: string }): Promise<HostResult> {
    const timeoutMs = agentTimeoutMs();
    const res = await this.withClient((c) =>
      c.callTool(
        {
          name: "run_agent",
          arguments: {
            runId: req.runId ?? "",
            agent: def,
            context: req.context,
            images: (req.images ?? []).map((i) => ({ mimeType: i.mimeType, dataBase64: i.data.toString("base64") })),
            timeoutMs,
          },
        },
        undefined,
        { timeout: timeoutMs, signal: req.signal },
      ),
    );
    const body = toolJSON(res) as { output?: unknown; model?: string };
    if (res.isError) throw new Error(`OpenSwarm ${def.slug}: ${textOf(res) || "agent failed"}`);
    if (!body || typeof body !== "object" || !("output" in body)) throw new Error(`OpenSwarm ${def.slug}: response has no "output"`);
    return { data: body.output, model: body.model ?? "openswarm" };
  }

  /** Read-only health check through the MCP `health` tool. Cached for 20 s. */
  async status(): Promise<HostStatus> {
    if (this.cached && Date.now() - this.cached.at < 20_000) return this.cached.status;
    let status: HostStatus;
    try {
      const res = await this.withClient((c) => c.callTool({ name: "health", arguments: {} }, undefined, { timeout: 4000 }));
      const h = toolJSON(res) as { ok?: boolean; openswarm?: { running?: boolean; signedIn?: boolean }; host?: string };
      const ready = !!(h?.ok && h.openswarm?.running && h.openswarm?.signedIn);
      status = {
        kind: "openswarm",
        connected: ready,
        label: ready ? "Host connected" : "Host not ready",
        detail: ready ? `OpenSwarm on ${h.host ?? this.baseUrl.host}` : "MCP reachable but OpenSwarm isn't running or signed in",
      };
    } catch (e) {
      status = { kind: "openswarm", connected: false, label: "Host offline", detail: `Can't reach ${this.baseUrl.host}: ${e instanceof Error ? e.message : e}` };
    }
    this.cached = { at: Date.now(), status };
    return status;
  }

  /** Read-only look around: list tools and call health. Used by `npm run host:probe`. */
  async probe() {
    return this.withClient(async (c) => {
      const tools = await c.listTools();
      const health = await c.callTool({ name: "health", arguments: {} }, undefined, { timeout: 5000 }).then(toolJSON, (e) => ({ error: String(e) }));
      return { server: c.getServerVersion(), tools: tools.tools.map((t) => ({ name: t.name, description: t.description })), health };
    });
  }
}

export function agentTimeoutMs(): number {
  return Number(process.env.OPENSWARM_AGENT_TIMEOUT_MS ?? 180_000);
}

type ToolResult = { [key: string]: unknown };

function textOf(res: ToolResult): string {
  const content = Array.isArray(res.content) ? (res.content as { type: string; text?: string }[]) : [];
  return content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
}

/** Contract: JSON in `structuredContent`, or one text content item holding JSON. */
export function toolJSON(res: ToolResult): unknown {
  if (res.structuredContent && typeof res.structuredContent === "object") return res.structuredContent;
  const text = textOf(res);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Host traffic must be private or encrypted: HTTPS (e.g. a Cloudflare Tunnel hostname)
 * or a Tailscale address (100.64.0.0/10 or *.ts.net). Never plain HTTP to an open port.
 */
export function validateHostUrl(raw: string): URL {
  const url = new URL(raw);
  const host = url.hostname;
  const tailnet = host.endsWith(".ts.net") || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(host);
  const local = host === "localhost" || host === "127.0.0.1";
  if (url.protocol === "https:" || tailnet || local) return url;
  throw new Error(`OPENSWARM_HOST_URL must use HTTPS or a private tunnel (Tailscale). Got ${url.protocol}//${host}`);
}

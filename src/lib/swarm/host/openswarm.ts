import type { AgentDefinition, HostResult, HostStatus, SwarmHost } from "./index";

/**
 * The OpenSwarm host: a separate device running OpenSwarm, reached through the team's
 * MCP server over HTTPS or a private tunnel (Tailscale / Cloudflare Tunnel).
 *
 * NOT IMPLEMENTED YET on purpose: the MCP's transport, tool names and auth haven't
 * been shared, and we don't guess the API. invoke() fails loudly so a misconfigured
 * deployment never silently falls back to fake results.
 */
export class OpenSwarmHost implements SwarmHost {
  kind = "openswarm" as const;
  constructor(private baseUrl: URL, private token: string) {}

  async invoke(def: AgentDefinition): Promise<HostResult> {
    throw new Error(`OpenSwarm connector not built yet (agent ${def.slug} ${def.version}). Set SWARM_HOST=mock until the MCP details are wired in.`);
  }

  /** Read-only reachability check. Says nothing about the API until the connector exists. */
  async status(): Promise<HostStatus> {
    try {
      const res = await fetch(this.baseUrl, {
        method: "GET",
        headers: this.token ? { authorization: `Bearer ${this.token}` } : {},
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      });
      return { kind: "openswarm", connected: false, label: "Host reachable", detail: `HTTP ${res.status}; connector pending` };
    } catch {
      return { kind: "openswarm", connected: false, label: "Host offline", detail: `Can't reach ${this.baseUrl.host}` };
    }
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

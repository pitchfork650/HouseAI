import type { AgentDefinition, HostResult, HostStatus, SwarmHost } from "./index";

/** Replays the sample runs. Simulated latency so the running state is visible. */
export class MockSwarmHost implements SwarmHost {
  kind = "mock" as const;

  async invoke(_def: AgentDefinition, req: { mock: () => unknown; signal?: AbortSignal }): Promise<HostResult> {
    const max = Number(process.env.MOCK_LATENCY_MS ?? (process.env.NODE_ENV === "test" ? 0 : 1200));
    if (max) {
      const ms = Math.round(max * (0.4 + Math.random() * 0.6));
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        req.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(req.signal?.reason ?? new Error("aborted"));
        });
      });
    }
    return { data: req.mock(), model: "mock" };
  }

  async status(): Promise<HostStatus> {
    return { kind: "mock", connected: false, label: "Mock swarm", detail: "OpenSwarm host not connected; replaying sample runs" };
  }
}

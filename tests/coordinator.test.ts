import { describe, expect, it } from "vitest";
import { MemoryRunStore, registerAgents, runPhase, type AgentSpec } from "@/lib/swarm/coordinator";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("swarm coordinator", () => {
  it("runs agents in parallel; a timeout in one never blocks the others", async () => {
    const store = new MemoryRunStore();
    const specs: AgentSpec<null>[] = [
      { name: "fast", scope: "", run: async (_i, ctx) => { ctx.log("hi"); return { status: "done", badge: "ok", result: "fast" }; } },
      { name: "hangs", scope: "", timeoutMs: 30, retries: 0, run: () => new Promise(() => {}) },
      { name: "slow", scope: "", run: async () => { await sleep(20); return { status: "done", badge: "ok", result: "slow" }; } },
    ];
    const ids = await registerAgents(store, specs);
    const t0 = Date.now();
    const out = await runPhase(store, ids, specs, null);
    expect(Date.now() - t0).toBeLessThan(500);
    expect(out.map((o) => o.status)).toEqual(["done", "failed", "done"]);
    expect(store.byName("hangs")!.log.at(-1)!.text).toMatch(/Timeout/);
    expect(store.byName("fast")!.log[0].text).toBe("hi");
  });

  it("retries a failing agent and records attempts", async () => {
    const store = new MemoryRunStore();
    let calls = 0;
    const spec: AgentSpec<null> = {
      name: "flaky",
      scope: "",
      retries: 2,
      run: async () => {
        calls++;
        if (calls < 3) throw new Error("boom");
        return { status: "done", badge: "ok", result: "third time" };
      },
    };
    const ids = await registerAgents(store, [spec]);
    const [o] = await runPhase(store, ids, [spec], null);
    expect(o.result).toBe("third time");
    expect(store.byName("flaky")!.attempts).toBe(3);
  });

  it("skips an agent with a reason and lets onExhausted schedule a retry", async () => {
    const store = new MemoryRunStore();
    const specs: AgentSpec<{ photo: boolean }>[] = [
      { name: "shade", scope: "", skip: (i) => (i.photo ? null : "No intraoral photo uploaded."), run: async () => ({ status: "done", badge: "", result: "" }) },
      { name: "lane", scope: "", retries: 0, run: async () => { throw new Error("down"); }, onExhausted: () => ({ status: "retry", badge: "Retry 14:00", result: "later" }) },
    ];
    const ids = await registerAgents(store, specs);
    const out = await runPhase(store, ids, specs, { photo: false });
    expect(out[0]).toMatchObject({ status: "skip", badge: "Skipped", result: "No intraoral photo uploaded." });
    expect(out[1]).toMatchObject({ status: "retry", badge: "Retry 14:00" });
  });
});

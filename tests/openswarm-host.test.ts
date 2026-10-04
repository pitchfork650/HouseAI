import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OpenSwarmHost, validateHostUrl } from "@/lib/swarm/host/openswarm";
import { definitionFor } from "@/lib/swarm/host";
import { SpecialistOutputSchema } from "@/lib/swarm/diagnostic/schemas";

const PORT = 8799;
let proc: ChildProcess;

beforeAll(async () => {
  proc = spawn(process.execPath, ["--import", "tsx", "host/server.ts"], { env: { ...process.env, PORT: String(PORT), OPENSWARM_TOKEN: "t0ken", HOST_MODE: "replay" }, stdio: "pipe" });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("host did not start")), 20_000);
    proc.stdout!.on("data", (d) => {
      if (String(d).includes("OpenSwarm MCP host")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}, 30_000);

afterAll(() => {
  proc?.kill();
});

describe("OpenSwarm host over MCP (reference server, replay mode)", () => {
  const url = validateHostUrl(`http://localhost:${PORT}`);

  it("reports connected via the health tool", async () => {
    const s = await new OpenSwarmHost(url, "t0ken").status();
    expect(s).toMatchObject({ kind: "openswarm", connected: true });
  });

  it("rejects a wrong token", async () => {
    const s = await new OpenSwarmHost(url, "nope").status();
    expect(s.connected).toBe(false);
    expect(s.label).toBe("Host offline");
  });

  it("runs an agent with its definition and returns schema-valid output", async () => {
    const def = definitionFor({ name: "Root-Tip Agent", slug: "root-tip", version: "v1", prompt: "p", schema: SpecialistOutputSchema });
    const res = await new OpenSwarmHost(url, "t0ken").invoke(def, { context: { ageYears: 34 }, images: [{ mimeType: "image/png", data: Buffer.from([1, 2, 3]) }], runId: "r1" });
    const out = SpecialistOutputSchema.parse(res.data);
    expect(out.summary).toBe("Dark area around 3 mm at the root tip of #30. Confidence 0.71.");
  });

  it("surfaces host-side agent errors", async () => {
    const def = definitionFor({ name: "X", slug: "unknown-agent", version: "v1", prompt: "p", schema: SpecialistOutputSchema });
    await expect(new OpenSwarmHost(url, "t0ken").invoke(def, { context: {} })).rejects.toThrow(/unknown-agent/);
  });
});

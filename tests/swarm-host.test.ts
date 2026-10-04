import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { assertMinimalContext, definitionFor, swarmHost } from "@/lib/swarm/host";
import { validateHostUrl } from "@/lib/swarm/host/openswarm";

describe("swarm host", () => {
  afterEach(() => {
    delete process.env.SWARM_HOST;
    delete process.env.OPENSWARM_HOST_URL;
  });

  it("defaults to the mock host", async () => {
    expect(swarmHost().kind).toBe("mock");
    expect((await swarmHost().status()).connected).toBe(false);
  });

  it("only allows HTTPS or private-tunnel host URLs", () => {
    expect(validateHostUrl("https://swarm.example.com").hostname).toBe("swarm.example.com");
    expect(validateHostUrl("http://dental-host.tail1234.ts.net:8324").hostname).toBe("dental-host.tail1234.ts.net");
    expect(validateHostUrl("http://100.101.102.103:8324").port).toBe("8324");
    expect(() => validateHostUrl("http://203.0.113.5:8324")).toThrow(/HTTPS or a private tunnel/);
  });

  it("never sends identifying fields to the host", () => {
    expect(() => assertMinimalContext({ ageYears: 34, studies: ["pano"] })).not.toThrow();
    expect(() => assertMinimalContext({ patient: { name: "Jordan M." } })).toThrow(/data minimization/);
    expect(() => assertMinimalContext({ dob: "x" })).toThrow();
  });

  it("sends the agent's output format with the definition", () => {
    const def = definitionFor({ name: "Skeptic", slug: "skeptic", version: "v1", prompt: "p", schema: z.object({ summary: z.string() }) });
    expect(def.outputSchema).toMatchObject({ type: "object", properties: { summary: { type: "string" } } });
  });
});

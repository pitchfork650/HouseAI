import { describe, expect, it } from "vitest";
import { MemoryRunStore, registerAgents, runPhase, type AgentSpec } from "@/lib/swarm/coordinator";
import { SPECIALISTS, collectCandidates, skepticSpec, specialistSpec, verifierSpec, type DiagnosticInput, type ReviewInput } from "@/lib/swarm/diagnostic/agents";
import { SpecialistOutputSchema } from "@/lib/swarm/diagnostic/schemas";

describe("diagnostic agents (mocked model responses)", () => {
  it("produces the sample badges and skips the shade agent without a photo", async () => {
    const store = new MemoryRunStore();
    const input: DiagnosticInput = { studies: [{ type: "pano" }, { type: "bitewing" }], context: { ageYears: 34 }, forceMock: true };
    const specs = SPECIALISTS.map(specialistSpec) as AgentSpec<DiagnosticInput, unknown>[];
    const out = await runPhase(store, await registerAgents(store, specs), specs, input);
    expect(out.map((o) => `${o.status}:${o.badge}`)).toEqual(["done:2 found", "flag:Flagged", "done:2 found", "done:1 found", "skip:Skipped"]);
    expect(out[4].result).toBe("No intraoral photo uploaded. Nothing else was affected.");
    for (const o of out.slice(0, 4)) expect(o.promptVersion).toBe("v2");

    const candidates = collectCandidates(specs.map((s, i) => ({ name: s.name, outcome: out[i] })));
    const review: ReviewInput = { ...input, candidates };
    const r2 = [verifierSpec, skepticSpec] as AgentSpec<ReviewInput, unknown>[];
    const [v, s] = await runPhase(store, await registerAgents(store, r2, 10), r2, review);
    expect(v.badge).toBe("5 of 6 confirmed");
    expect(s).toMatchObject({ status: "flag", badge: "Challenged 1" });
  });

  it("rejects malformed model JSON via zod", () => {
    expect(() => SpecialistOutputSchema.parse({ findings: [{ teeth: [40], condition: "caries_enamel", detail: "", confidence: 2 }], summary: "" })).toThrow();
  });
});

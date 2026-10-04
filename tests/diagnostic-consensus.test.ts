import { describe, expect, it } from "vitest";
import { mergeFindings, skipNote } from "@/lib/swarm/diagnostic/consensus";
import { MOCK_SPECIALISTS, mockConsensus, mockSkeptic, mockVerifier } from "@/lib/swarm/diagnostic/mocks";
import type { Candidate } from "@/lib/swarm/diagnostic/schemas";

function candidates(): Candidate[] {
  let i = 0;
  return ["Caries Scout", "Root-Tip Agent", "Third-Molar Agent", "Restoration Auditor"].flatMap((name) =>
    MOCK_SPECIALISTS[name]().findings.map((f) => ({ ...f, id: `c${++i}`, reporter: name })),
  );
}

describe("diagnostic consensus", () => {
  it("scores agreement as reporter + Verifier + Skeptic and reproduces the sample table", () => {
    const c = candidates();
    const v = mockVerifier(c);
    const s = mockSkeptic(c);
    expect(v.summary).toBe("Confirmed #3, #19, #17, #32 and #30. Could not confirm the #14 margin gap on the panoramic alone.");
    expect(s.challenges).toHaveLength(1);
    const rows = mergeFindings(c, v, s);
    const text = new Map(mockConsensus(rows).rows.map((r) => [r.key, r.text]));
    expect(rows.map((r) => [r.teeth.join(" "), text.get(r.key), `${r.agreement}/3`, r.suggested, r.priority])).toEqual([
      ["30", "Dark spot at the root tip (likely infection)", "2/3", "D3330 root canal, molar · 75 min (D0220 PA film first)", "P1"],
      ["32", "Impacted wisdom tooth (completely bony), roots on the nerve canal", "3/3", "D7240 · 60 min (D0367 CBCT first)", "P2"],
      ["17", "Impacted wisdom tooth (partially bony)", "3/3", "D7230 · 45 min", "P2"],
      ["14", "Gap at the crown edge (open margin)", "2/3", "D2740 new crown · 90 min, 2 visits", "P3"],
      ["3 19", "Cavities between teeth, into the dentin", "3/3", "D2391 ×2 · 45 min, one visit", "P3"],
    ]);
  });

  it("drops agreement when the verifier or skeptic is missing", () => {
    const rows = mergeFindings(candidates(), null, null);
    // Without a verifier no finding is confirmed; without a skeptic nothing is challenged.
    expect(rows.every((r) => r.agreement === 2)).toBe(true);
  });

  it("generates the panel footer from what was skipped", () => {
    const agents = [
      { name: "Caries Scout", status: "done" },
      { name: "Shade Agent", status: "skip", skipPhrase: "had no intraoral photo to read" },
    ];
    expect(skipNote(agents)).toBe("The shade agent had no intraoral photo to read, so it was skipped. The other agents still finished, and the consensus notes what wasn't checked.");
    expect(skipNote([{ name: "A", status: "done" }])).toBe("All 1 agents finished. Nothing was skipped.");
  });
});

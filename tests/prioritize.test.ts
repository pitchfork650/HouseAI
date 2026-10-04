import { describe, expect, it } from "vitest";
import { comparePlan, prioritize } from "@/lib/rules/prioritize";

describe("prioritizer rules", () => {
  it("maps a challenged molar root-tip lesion to D3330, P1, PA film first", () => {
    const p = prioritize("periapical_lesion", { teeth: [30], challenged: true, nearNerveCanal: false, agreement: 2 });
    expect(p).toMatchObject({ cdtCode: "D3330", durationMin: 75, priority: "P1", prerequisite: "D0220" });
    expect(p.suggested).toBe("D3330 root canal, molar · 75 min (D0220 PA film first)");
  });

  it("requires CBCT for a bony impaction near the nerve canal", () => {
    expect(prioritize("impacted_complete_bony", { teeth: [32], challenged: false, nearNerveCanal: true, agreement: 3 }).suggested).toBe("D7240 · 60 min (D0367 CBCT first)");
    expect(prioritize("impacted_partial_bony", { teeth: [17], challenged: false, nearNerveCanal: false, agreement: 3 }).suggested).toBe("D7230 · 45 min");
  });

  it("formats multi-visit and grouped procedures", () => {
    expect(prioritize("open_margin", { teeth: [14], challenged: false, nearNerveCanal: false, agreement: 2 }).suggested).toBe("D2740 new crown · 90 min, 2 visits");
    const caries = prioritize("caries_dentin_interproximal", { teeth: [3, 19], challenged: false, nearNerveCanal: false, agreement: 3 });
    expect(caries.suggested).toBe("D2391 ×2 · 45 min, one visit");
    expect(caries.priority).toBe("P3");
  });

  it("uses tooth type for root canal codes", () => {
    expect(prioritize("periapical_lesion", { teeth: [8], challenged: false, nearNerveCanal: false, agreement: 3 }).cdtCode).toBe("D3310");
    expect(prioritize("periapical_lesion", { teeth: [5], challenged: false, nearNerveCanal: false, agreement: 3 }).cdtCode).toBe("D3320");
  });

  it("orders the plan by priority, then longer cases first", () => {
    const items = [
      { priority: "P3" as const, durationMin: 45 },
      { priority: "P2" as const, durationMin: 45 },
      { priority: "P3" as const, durationMin: 90 },
      { priority: "P1" as const, durationMin: 75 },
      { priority: "P2" as const, durationMin: 60 },
    ];
    expect(items.sort(comparePlan).map((i) => `${i.priority}/${i.durationMin}`)).toEqual(["P1/75", "P2/60", "P2/45", "P3/90", "P3/45"]);
  });
});

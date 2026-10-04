import { describe, expect, it } from "vitest";
import { compareFindings } from "@/lib/recall";

describe("recall comparison", () => {
  it("flags new, progressed, unchanged and no-longer-seen teeth", () => {
    const before = [
      { tooth: 3, condition: "caries_enamel", text: "enamel", priority: "P4" },
      { tooth: 12, condition: "caries_enamel", text: "enamel", priority: "P4" },
      { tooth: 32, condition: "impacted_complete_bony", text: "impacted", priority: "P2" },
    ];
    const now = [
      { tooth: 3, condition: "caries_dentin_interproximal", text: "dentin", priority: "P3" },
      { tooth: 30, condition: "periapical_lesion", text: "root tip", priority: "P1" },
      { tooth: 32, condition: "impacted_complete_bony", text: "impacted", priority: "P2" },
    ];
    expect(compareFindings(before, now).map((r) => [r.tooth, r.change])).toEqual([
      [30, "new"],
      [3, "progressed"],
      [12, "not_seen"],
      [32, "unchanged"],
    ]);
  });
});

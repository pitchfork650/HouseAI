import { describe, expect, it } from "vitest";
import { compareByBox, compareToGroundTruth, consensusBoxes, fdiToUniversal, type GroundTruth } from "@/lib/ground-truth";
import { box2dToOverlay, pixelBoxToOverlay } from "@/lib/xray-frame";

describe("ground truth", () => {
  it("maps FDI to Universal numbering", () => {
    expect([18, 11, 21, 28, 38, 31, 41, 48].map(fdiToUniversal)).toEqual([1, 8, 9, 16, 17, 24, 25, 32]);
  });

  it("scores findings by tooth and kind of problem", () => {
    const box = { x: 0, y: 0, w: 1, h: 1 };
    const truth: GroundTruth[] = [
      { tooth: 1, fdi: 18, label: "impacted", box },
      { tooth: 20, fdi: 35, label: "periapical_lesion", box },
      { tooth: 30, fdi: 46, label: "deep_caries", box },
    ];
    const c = compareToGroundTruth(
      [
        { teeth: [1], condition: "impacted_partial_bony" },
        { teeth: [30], condition: "caries_enamel" },
        { teeth: [3], condition: "caries_enamel" },
        { teeth: [14], condition: "open_margin" },
      ],
      truth,
    );
    expect(c.matched).toEqual([{ tooth: 1, family: "impacted" }, { tooth: 30, family: "caries" }]);
    expect(c.missed).toEqual([{ tooth: 20, family: "periapical" }]);
    expect(c.extra).toEqual([{ tooth: 3, family: "caries" }]);
    expect(c.unscored).toEqual([{ teeth: [14], condition: "open_margin" }]);
  });
});

describe("box-only labels", () => {
  it("keeps lesions most experts marked and averages their boxes", () => {
    const b = (x: number) => ({ x, y: 0, w: 10, h: 10 });
    const out = consensusBoxes(
      [
        { annotator: "E1", box: b(0) },
        { annotator: "E2", box: b(2) },
        { annotator: "E3", box: b(1) },
        { annotator: "E1", box: b(100) }, // only one expert
      ],
      3,
    );
    expect(out).toEqual([{ votes: 3, box: { x: 1, y: 0, w: 10, h: 10 } }]);
  });

  it("matches reported boxes to labelled boxes by overlap and family", () => {
    const c = compareByBox(
      [
        { condition: "caries_enamel", boxes: [{ x: 0, y: 0, w: 30, h: 30 }, { x: 200, y: 0, w: 10, h: 10 }] },
        { condition: "open_margin", boxes: [{ x: 50, y: 50, w: 5, h: 5 }] },
      ],
      [
        { family: "caries", box: { x: 5, y: 5, w: 10, h: 10 } },
        { family: "caries", box: { x: 400, y: 0, w: 10, h: 10 } },
      ],
    );
    expect(c.matched).toEqual([{ ref: "L1", family: "caries" }]);
    expect(c.missed).toEqual([{ ref: "L2", family: "caries" }]);
    expect(c.extra).toEqual([{ ref: "R2", family: "caries" }]);
    expect(c.unscored).toHaveLength(1);
  });
});

describe("x-ray frame", () => {
  it("letterboxes a wide pano into 800×400", () => {
    // 2000×800 scales by 0.4 → 800×320, centred with 40 px bars top and bottom.
    const o = pixelBoxToOverlay({ x: 1000, y: 400, w: 100, h: 50 }, "#1", { width: 2000, height: 800 });
    expect(o).toMatchObject({ kind: "box", x: 400, y: 200, w: 40, h: 20 });
  });

  it("converts Gemini box_2d (0–1000) to the same frame", () => {
    const o = box2dToOverlay([500, 500, 562.5, 550], "#1", { width: 2000, height: 800 });
    expect(o).toMatchObject({ x: 400, y: 200, w: 40, h: 20 });
  });
});

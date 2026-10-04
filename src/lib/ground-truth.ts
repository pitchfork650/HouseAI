/**
 * Expert labels for public-dataset X-rays and how a swarm run compares.
 * Labels come either per tooth (FDI numbering, mapped to Universal) or as boxes
 * only (e.g. bitewing caries marked by several dentists). Both sides are mapped
 * to a family; box-only labels are matched by overlap instead of tooth number.
 */
export type DatasetLabel = "caries" | "deep_caries" | "periapical_lesion" | "impacted";
export type Box = { x: number; y: number; w: number; h: number };
/** `box` in image pixels. `votes`: how many experts marked it, when several did. */
export type GroundTruth = { tooth?: number; fdi?: number; label: DatasetLabel; box: Box; votes?: number };
export type Family = "caries" | "periapical" | "impacted";

export const LABEL_TEXT: Record<DatasetLabel, string> = { caries: "Caries", deep_caries: "Deep caries", periapical_lesion: "Periapical lesion", impacted: "Impacted" };
export const FAMILY_TEXT: Record<Family, string> = { caries: "Caries", periapical: "Periapical lesion", impacted: "Impacted tooth" };

/** FDI (quadrant 1–4, tooth 1–8) → Universal #1–#32. */
export function fdiToUniversal(fdi: number): number {
  const q = Math.floor(fdi / 10), n = fdi % 10;
  if (q === 1) return 9 - n;
  if (q === 2) return 8 + n;
  if (q === 3) return 25 - n;
  if (q === 4) return 24 + n;
  throw new Error(`Not an adult FDI tooth number: ${fdi}`);
}

export function labelFamily(l: DatasetLabel): Family {
  return l === "periapical_lesion" ? "periapical" : l === "impacted" ? "impacted" : "caries";
}

/** App condition key → family, or null when the dataset doesn't label it (e.g. open margins). */
export function conditionFamily(condition: string): Family | null {
  if (condition.startsWith("caries")) return "caries";
  if (condition === "periapical_lesion") return "periapical";
  if (condition.startsWith("impacted")) return "impacted";
  return null;
}

/** A scored item: a tooth (tooth-labelled data) or the n-th labelled / reported box (box-only data). */
export type Scored = { tooth?: number; ref?: string; family: Family };

export type Comparison = {
  matched: Scored[];
  missed: Scored[];
  extra: Scored[];
  /** Findings in categories the dataset doesn't label: not scored. */
  unscored: { teeth: number[]; condition: string }[];
};

/** Tooth + family match: a finding counts if it names the labelled tooth with the same kind of problem. */
export function compareToGroundTruth(findings: { teeth: number[]; condition: string }[], truth: GroundTruth[]): Comparison {
  if (truth.some((g) => g.tooth == null)) throw new Error("Box-only labels: use compareByBox");
  const key = (t: number, f: Family) => `${f}:${t}`;
  const want = new Map(truth.map((g) => [key(g.tooth!, labelFamily(g.label)), { tooth: g.tooth!, family: labelFamily(g.label) }]));
  const got = new Map<string, Scored>();
  const unscored: Comparison["unscored"] = [];
  for (const f of findings) {
    const fam = conditionFamily(f.condition);
    if (!fam) unscored.push({ teeth: f.teeth, condition: f.condition });
    else for (const t of f.teeth) got.set(key(t, fam), { tooth: t, family: fam });
  }
  const byTooth = (a: Scored, b: Scored) => (a.tooth ?? 0) - (b.tooth ?? 0);
  return {
    matched: [...want].filter(([k]) => got.has(k)).map(([, v]) => v).sort(byTooth),
    missed: [...want].filter(([k]) => !got.has(k)).map(([, v]) => v).sort(byTooth),
    extra: [...got].filter(([k]) => !want.has(k)).map(([, v]) => v).sort(byTooth),
    unscored,
  };
}

/** Overlap as a share of the smaller box: small lesion boxes inside a loose model box still count. */
export function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

/**
 * Box match for box-only labels. Truth boxes and finding boxes must be in the same
 * coordinates (the viewer frame). Each labelled box is matched to at most one
 * reported box of the same family that overlaps it by at least `min`.
 */
export function compareByBox(
  findings: { condition: string; boxes: Box[] }[],
  truth: { family: Family; box: Box }[],
  min = 0.3,
): Comparison {
  const reported: { family: Family; box: Box; ref: string }[] = [];
  const unscored: Comparison["unscored"] = [];
  for (const f of findings) {
    const fam = conditionFamily(f.condition);
    if (!fam) unscored.push({ teeth: [], condition: f.condition });
    else for (const b of f.boxes) reported.push({ family: fam, box: b, ref: `R${reported.length + 1}` });
  }
  const used = new Set<string>();
  const matched: Scored[] = [], missed: Scored[] = [];
  truth.forEach((t, i) => {
    const ref = `L${i + 1}`;
    const hit = reported.filter((r) => r.family === t.family && !used.has(r.ref)).sort((a, b) => overlap(t.box, b.box) - overlap(t.box, a.box))[0];
    if (hit && overlap(t.box, hit.box) >= min) {
      used.add(hit.ref);
      matched.push({ ref, family: t.family });
    } else missed.push({ ref, family: t.family });
  });
  const extra = reported.filter((r) => !used.has(r.ref)).map((r) => ({ ref: r.ref, family: r.family }));
  return { matched, missed, extra, unscored };
}

/**
 * Consensus of several annotators' boxes: cluster boxes that overlap, keep clusters
 * marked by at least `quorum` different annotators, average them.
 */
export function consensusBoxes(boxes: { annotator: string; box: Box }[], quorum: number, min = 0.3): { box: Box; votes: number }[] {
  const clusters: { members: { annotator: string; box: Box }[] }[] = [];
  for (const b of boxes) {
    const c = clusters.find((c) => c.members.some((m) => overlap(m.box, b.box) >= min) && !c.members.some((m) => m.annotator === b.annotator));
    if (c) c.members.push(b);
    else clusters.push({ members: [b] });
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return clusters
    .filter((c) => c.members.length >= quorum)
    .map((c) => ({
      votes: c.members.length,
      box: { x: mean(c.members.map((m) => m.box.x)), y: mean(c.members.map((m) => m.box.y)), w: mean(c.members.map((m) => m.box.w)), h: mean(c.members.map((m) => m.box.h)) },
    }));
}

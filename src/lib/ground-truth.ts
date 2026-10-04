/**
 * Expert labels for public-dataset X-rays (DENTEX) and how a swarm run compares.
 * DENTEX labels four diagnoses per tooth (FDI numbering); the app uses Universal
 * numbering and its own condition keys, so both sides are mapped to a family.
 */
export type DatasetLabel = "caries" | "deep_caries" | "periapical_lesion" | "impacted";
export type GroundTruth = { tooth: number; fdi: number; label: DatasetLabel; box: { x: number; y: number; w: number; h: number } };
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

export type Comparison = {
  matched: { tooth: number; family: Family }[];
  missed: { tooth: number; family: Family }[];
  extra: { tooth: number; family: Family }[];
  /** Findings in categories the dataset doesn't label: not scored. */
  unscored: { teeth: number[]; condition: string }[];
};

/** Tooth + family match: a finding counts if it names the labelled tooth with the same kind of problem. */
export function compareToGroundTruth(findings: { teeth: number[]; condition: string }[], truth: GroundTruth[]): Comparison {
  const key = (t: number, f: Family) => `${f}:${t}`;
  const want = new Map(truth.map((g) => [key(g.tooth, labelFamily(g.label)), { tooth: g.tooth, family: labelFamily(g.label) }]));
  const got = new Map<string, { tooth: number; family: Family }>();
  const unscored: Comparison["unscored"] = [];
  for (const f of findings) {
    const fam = conditionFamily(f.condition);
    if (!fam) unscored.push({ teeth: f.teeth, condition: f.condition });
    else for (const t of f.teeth) got.set(key(t, fam), { tooth: t, family: fam });
  }
  const byTooth = (a: { tooth: number }, b: { tooth: number }) => a.tooth - b.tooth;
  return {
    matched: [...want].filter(([k]) => got.has(k)).map(([, v]) => v).sort(byTooth),
    missed: [...want].filter(([k]) => !got.has(k)).map(([, v]) => v).sort(byTooth),
    extra: [...got].filter(([k]) => !want.has(k)).map(([, v]) => v).sort(byTooth),
    unscored,
  };
}

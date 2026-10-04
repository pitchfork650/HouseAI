import { overlayFor } from "../../pano";
import type { Candidate, ConsensusOutput, SkepticOutput, SpecialistOutput, VerifierOutput } from "./schemas";

/**
 * Canned model responses for mock mode. They reproduce the seed sample case
 * (P-1042) exactly; real model calls replace them when GEMINI_API_KEY is set.
 */
export const MOCK_SPECIALISTS: Record<string, () => SpecialistOutput> = {
  "Caries Scout": () => ({
    findings: [
      { teeth: [3], condition: "caries_dentin_interproximal", detail: "#3 (side facing #4)", confidence: 0.86, overlay: [overlayFor(3, "dot-below", "#3")] },
      { teeth: [19], condition: "caries_dentin_interproximal", detail: "#19 (side facing #20)", confidence: 0.83, overlay: [overlayFor(19, "dot-above", "#19")] },
    ],
    summary: "Dentin-level cavities on #3 (side facing #4) and #19 (side facing #20).",
  }),
  "Root-Tip Agent": () => ({
    findings: [{ teeth: [30], condition: "periapical_lesion", detail: "Dark area around 3 mm at the root tip of #30", confidence: 0.71, overlay: [overlayFor(30, "apex", "#30 root tip")] }],
    summary: "Dark area around 3 mm at the root tip of #30. Confidence 0.71.",
  }),
  "Third-Molar Agent": () => ({
    findings: [
      { teeth: [32], condition: "impacted_complete_bony", detail: "#32 completely bony, roots overlap the nerve canal", confidence: 0.9, nearNerveCanal: true, overlay: [overlayFor(32, "box-below", "#32 near canal")] },
      { teeth: [17], condition: "impacted_partial_bony", detail: "#17 partially bony", confidence: 0.88, nearNerveCanal: false, overlay: [overlayFor(17, "box-below", "#17 partly bony")] },
    ],
    summary: "#32 roots overlap the nerve canal; recommend a 3D scan (CBCT) before surgery.",
  }),
  "Restoration Auditor": () => ({
    findings: [{ teeth: [14], condition: "open_margin", detail: "Open margin on the #14 crown, near the gumline", confidence: 0.64, overlay: [overlayFor(14, "box-above", "#14 open margin")] }],
    summary: "Open margin on the #14 crown, near the gumline.",
  }),
  "Shade Agent": () => ({ findings: [], summary: "No shade mismatch found." }),
};

const teethList = (teeth: number[]) =>
  teeth.length <= 1 ? teeth.map((t) => `#${t}`).join("") : `${teeth.slice(0, -1).map((t) => `#${t}`).join(", ")} and #${teeth[teeth.length - 1]}`;

export function mockVerifier(cands: Candidate[]): VerifierOutput {
  // The panoramic alone can't confirm a crown-margin gap; everything else is confirmed.
  const results = cands.map((c) => ({
    id: c.id,
    confirmed: c.condition !== "open_margin",
    note: c.condition === "open_margin" ? `Could not confirm the #${c.teeth[0]} margin gap on the panoramic alone.` : "Confirmed.",
  }));
  const order = ["Caries Scout", "Third-Molar Agent", "Root-Tip Agent", "Restoration Auditor"];
  const confirmed = cands
    .filter((c) => c.condition !== "open_margin")
    .sort((a, b) => order.indexOf(a.reporter) - order.indexOf(b.reporter) || a.teeth[0] - b.teeth[0])
    .flatMap((c) => c.teeth);
  // Caries teeth read in ascending order; molars in the order the agent reported them.
  const caries = cands.filter((c) => c.condition.startsWith("caries")).flatMap((c) => c.teeth).sort((a, b) => a - b);
  const rest = confirmed.filter((t) => !caries.includes(t));
  const notes = results.filter((r) => !r.confirmed).map((r) => r.note);
  return { results, summary: [`Confirmed ${teethList([...caries, ...rest])}.`, ...notes].join(" ") };
}

export function mockSkeptic(cands: Candidate[]): SkepticOutput {
  const challenges = cands
    .filter((c) => c.condition === "periapical_lesion" && c.confidence < 0.8)
    .map((c) => ({ id: c.id, reason: `The #${c.teeth[0]} dark area could be an overlapping shadow. Confirm with a periapical film before treating.` }));
  return { challenges, summary: challenges.map((c) => c.reason).join(" ") || "No challenges: every finding is consistent across views." };
}

const PLAIN: Record<string, (teeth: number[], nearCanal: boolean) => string> = {
  periapical_lesion: () => "Dark spot at the root tip (likely infection)",
  impacted_complete_bony: (_t, near) => `Impacted wisdom tooth (completely bony)${near ? ", roots on the nerve canal" : ""}`,
  impacted_partial_bony: (_t, near) => `Impacted wisdom tooth (partially bony)${near ? ", roots on the nerve canal" : ""}`,
  impacted_soft_tissue: () => "Impacted wisdom tooth (soft tissue only)",
  open_margin: () => "Gap at the crown edge (open margin)",
  caries_dentin_interproximal: (t) => (t.length > 1 ? "Cavities between teeth, into the dentin" : "Cavity between teeth, into the dentin"),
  caries_enamel: () => "Early enamel cavity, not into the dentin yet",
  shade_mismatch: () => "Shade mismatch on front teeth",
};

export function mockConsensus(rows: { key: string; condition: string; teeth: number[]; nearNerveCanal: boolean }[]): ConsensusOutput {
  return { rows: rows.map((r) => ({ key: r.key, text: (PLAIN[r.condition] ?? (() => r.condition))(r.teeth, r.nearNerveCanal) })) };
}

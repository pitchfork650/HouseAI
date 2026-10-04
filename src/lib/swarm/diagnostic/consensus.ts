import { comparePlan, isGroupable, prioritize, type Condition, type Prioritized } from "../../rules/prioritize";
import type { Candidate, Overlay, SkepticOutput, VerifierOutput } from "./schemas";

export type ConsensusRow = Prioritized & {
  key: string;
  condition: Condition;
  teeth: number[];
  reporter: string;
  agreement: number; // reporter + Verifier + Skeptic, out of 3
  challenged: boolean;
  nearNerveCanal: boolean;
  confidence: number;
  overlay: Overlay[];
};

/**
 * Consensus: a finding's agreement is reporter + Verifier + Skeptic out of 3.
 * Groupable findings (e.g. cavities) from the same reporter merge into one row,
 * then each row is mapped to a procedure by the prioritizer rules.
 */
export function mergeFindings(cands: Candidate[], verifier: VerifierOutput | null, skeptic: SkepticOutput | null): ConsensusRow[] {
  const confirmed = new Map(verifier?.results.map((r) => [r.id, r.confirmed]) ?? []);
  const challenged = new Set(skeptic?.challenges.map((c) => c.id) ?? []);

  const groups = new Map<string, Candidate[]>();
  for (const c of cands) {
    const key = isGroupable(c.condition) ? `${c.condition}:${c.reporter}` : `${c.condition}:${c.teeth.join("-")}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  const rows: ConsensusRow[] = [];
  for (const [key, members] of groups) {
    const teeth = [...new Set(members.flatMap((m) => m.teeth))].sort((a, b) => a - b);
    const allConfirmed = members.every((m) => confirmed.get(m.id) === true);
    const anyChallenged = members.some((m) => challenged.has(m.id));
    const agreement = 1 + (allConfirmed ? 1 : 0) + (anyChallenged ? 0 : 1);
    const nearNerveCanal = members.some((m) => m.nearNerveCanal);
    const condition = members[0].condition;
    const p = prioritize(condition, { teeth, challenged: anyChallenged, nearNerveCanal, agreement });
    rows.push({
      ...p,
      key,
      condition,
      teeth,
      reporter: members[0].reporter,
      agreement,
      challenged: anyChallenged,
      nearNerveCanal,
      confidence: Math.min(...members.map((m) => m.confidence)),
      overlay: members.flatMap((m) => m.overlay),
    });
  }
  return rows.sort(comparePlan);
}

/** Panel footer, generated from what was actually skipped or failed. */
export function skipNote(agents: { name: string; status: string; skipPhrase?: string }[]): string {
  const skipped = agents.filter((a) => a.status === "skip");
  const failed = agents.filter((a) => a.status === "failed");
  const parts: string[] = [];
  for (const a of skipped) parts.push(`The ${a.name.toLowerCase()} ${a.skipPhrase ?? "had nothing to read"}, so it was skipped.`);
  for (const a of failed) parts.push(`The ${a.name.toLowerCase()} did not finish.`);
  if (!parts.length) return `All ${agents.length} agents finished. Nothing was skipped.`;
  return `${parts.join(" ")} The other agents still finished, and the consensus notes what wasn't checked.`;
}

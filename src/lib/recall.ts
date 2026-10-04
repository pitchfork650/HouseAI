import { prisma } from "./db";

/**
 * Recall comparison: at the next recall X-ray, compare the latest swarm findings
 * with the previous run's findings, tooth by tooth, and flag what changed.
 */
export type ToothFinding = { tooth: number; condition: string; text: string; priority: string };
export type Change = "new" | "progressed" | "improved" | "unchanged" | "not_seen";
export type RecallRow = { tooth: number; before: ToothFinding | null; now: ToothFinding | null; change: Change };

const PRIO_RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

export function compareFindings(before: ToothFinding[], now: ToothFinding[]): RecallRow[] {
  const by = (list: ToothFinding[]) => {
    const m = new Map<number, ToothFinding>();
    for (const f of list) {
      const cur = m.get(f.tooth);
      if (!cur || PRIO_RANK[f.priority] < PRIO_RANK[cur.priority]) m.set(f.tooth, f);
    }
    return m;
  };
  const b = by(before), n = by(now);
  const teeth = [...new Set([...b.keys(), ...n.keys()])];
  const rows = teeth.map((tooth): RecallRow => {
    const x = b.get(tooth) ?? null, y = n.get(tooth) ?? null;
    let change: Change;
    if (!x) change = "new";
    else if (!y) change = "not_seen";
    else if (x.condition === y.condition) change = "unchanged";
    else change = PRIO_RANK[y.priority] < PRIO_RANK[x.priority] ? "progressed" : "improved";
    return { tooth, before: x, now: y, change };
  });
  const order: Record<Change, number> = { new: 0, progressed: 1, improved: 2, not_seen: 3, unchanged: 4 };
  return rows.sort((p, q) => order[p.change] - order[q.change] || PRIO_RANK[p.now?.priority ?? "P4"] - PRIO_RANK[q.now?.priority ?? "P4"] || p.tooth - q.tooth);
}

const explode = (fs: { teeth: unknown; condition: string; text: string; priority: string }[]): ToothFinding[] =>
  fs.flatMap((f) => (f.teeth as number[]).map((tooth) => ({ tooth, condition: f.condition, text: f.text, priority: f.priority })));

export async function recallForPatient(patientId: string) {
  const runs = await prisma.swarmRun.findMany({
    where: { patientId, kind: "diagnostic", status: { in: ["done", "partial"] } },
    orderBy: { startedAt: "desc" },
    take: 2,
    include: { findings: true, study: true },
  });
  if (runs.length < 2) return null;
  const [now, before] = runs;
  return {
    now: { runId: now.id, date: (now.study?.takenAt ?? now.startedAt).toISOString().slice(0, 10) },
    before: { runId: before.id, date: (before.study?.takenAt ?? before.startedAt).toISOString().slice(0, 10) },
    rows: compareFindings(explode(before.findings.filter((f) => f.status !== "rejected")), explode(now.findings.filter((f) => f.status !== "rejected"))),
  };
}

/**
 * Run the diagnostic swarm on the imported dataset X-rays and score it against the
 * expert labels. Needs DIAGNOSTIC_HOST=gemini and a key for a real read; otherwise
 * it scores the mock replay, which is meaningless.
 *
 *   npm run xrays:eval               # every imported BW-* patient
 *   npm run xrays:eval -- BW-07      # just these
 *   npm run xrays:eval -- --rescore  # score the latest stored runs, no model calls
 *
 * Scores twice: every finding, and only findings at least 2 of 3 agents (reporter,
 * Verifier, Skeptic) agree on, which is what the swarm is for.
 */
import { prisma } from "../src/lib/db";
import { diagnosticHost } from "../src/lib/swarm/host";
import { startDiagnosticRun } from "../src/lib/swarm/diagnostic/run";
import { scoreFindings } from "../src/lib/xray-score";
import type { Comparison, Family } from "../src/lib/ground-truth";
import type { OverlayShape } from "../src/lib/pano";

const PREFIX = "BW-";
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const tally = () => ({ matched: 0, missed: 0, extra: 0 });

async function main() {
  const rescore = process.argv.includes("--rescore");
  if (!rescore && diagnosticHost().kind !== "gemini") console.warn("DIAGNOSTIC_HOST is not gemini: scoring the mock replay, not a real read.\n");
  const ids = process.argv.slice(2).filter((a) => a.startsWith(PREFIX));
  const patients = await prisma.patient.findMany({ where: ids.length ? { id: { in: ids } } : { id: { startsWith: PREFIX } }, orderBy: { id: "asc" } });
  if (!patients.length) throw new Error("No dataset patients. Run npm run xrays:import first.");

  const scores = { all: { totals: tally(), fam: {} as Record<string, ReturnType<typeof tally>> }, agreed: { totals: tally(), fam: {} as Record<string, ReturnType<typeof tally>> } };
  const add = (which: keyof typeof scores, c: Comparison) => {
    for (const k of ["matched", "missed", "extra"] as const) {
      scores[which].totals[k] += c[k].length;
      for (const x of c[k]) (scores[which].fam[x.family] ??= tally())[k]++;
    }
  };

  for (const p of patients) {
    const started = Date.now();
    const runId = rescore
      ? (await prisma.swarmRun.findFirst({ where: { patientId: p.id, kind: "diagnostic", status: { not: "running" } }, orderBy: { startedAt: "desc" }, select: { id: true } }))?.id
      : await startDiagnosticRun(p.id, { actor: "script:xray-eval", wait: true });
    if (!runId) {
      console.log(`${p.id}  no run yet`);
      continue;
    }
    const run = await prisma.swarmRun.findUniqueOrThrow({ where: { id: runId }, include: { findings: true, study: true } });
    if (run.status === "failed" || !run.study) {
      console.log(`${p.id}  failed (not scored): ${String((run.summary as { error?: string })?.error ?? "").slice(0, 160)}`);
      continue;
    }
    const rows = run.findings.map((f) => ({ teeth: f.teeth as number[], condition: f.condition, overlay: f.overlay as OverlayShape[], agreement: f.agreement }));
    const c = scoreFindings(rows, run.study);
    const agreed = scoreFindings(rows.filter((f) => f.agreement >= 2), run.study);
    if (!c || !agreed) continue;
    add("all", c);
    add("agreed", agreed);
    const model = (await prisma.agentRun.findFirst({ where: { runId, model: { not: null } }, select: { model: true } }))?.model ?? "?";
    console.log(`${p.id}  ${run.status}  ${model}  found ${c.matched.length}/${c.matched.length + c.missed.length}  extra ${c.extra.length} (≥2/3 agree: ${agreed.matched.length} found, ${agreed.extra.length} extra)  ${rescore ? "" : `${Math.round((Date.now() - started) / 1000)} s`}`);
  }
  for (const [which, title] of [["all", "Every finding"], ["agreed", "Findings with ≥2/3 agreement"]] as const) {
    const { totals, fam } = scores[which];
    console.log(`\n${title}: recall ${pct(totals.matched, totals.matched + totals.missed)}  precision ${pct(totals.matched, totals.matched + totals.extra)}  (${totals.matched} found, ${totals.missed} missed, ${totals.extra} extra)`);
    for (const [k, v] of Object.entries(fam) as [Family, ReturnType<typeof tally>][]) console.log(`  ${k.padEnd(11)} recall ${pct(v.matched, v.matched + v.missed).padStart(4)}  precision ${pct(v.matched, v.matched + v.extra).padStart(4)}  (${v.matched}/${v.matched + v.missed}, ${v.extra} extra)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

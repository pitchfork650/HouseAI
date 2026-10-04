/**
 * Run the diagnostic swarm on the imported DENTEX X-rays and score it against the
 * expert labels (tooth + kind of problem). Needs DIAGNOSTIC_HOST=gemini and a key
 * for a real read; otherwise it scores the mock replay, which is meaningless.
 *
 *   npm run dentex:eval              # every imported DX-* patient
 *   npm run dentex:eval -- DX-38     # just these
 *   npm run dentex:eval -- --rescore # score the latest stored runs, no model calls
 *
 * Scores twice: every finding, and only findings that at least 2 of 3 agents
 * (reporter, Verifier, Skeptic) agree on, which is what the swarm is for.
 */
import { prisma } from "../src/lib/db";
import { diagnosticHost } from "../src/lib/swarm/host";
import { startDiagnosticRun } from "../src/lib/swarm/diagnostic/run";
import { compareToGroundTruth, type Family, type GroundTruth } from "../src/lib/ground-truth";

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");

async function main() {
  const host = diagnosticHost();
  if (host.kind !== "gemini") console.warn("DIAGNOSTIC_HOST is not gemini: scoring the mock replay, not a real read.\n");
  const ids = process.argv.slice(2).filter((a) => a.startsWith("DX-"));
  const patients = await prisma.patient.findMany({ where: ids.length ? { id: { in: ids } } : { id: { startsWith: "DX-" } }, orderBy: { id: "asc" } });
  if (!patients.length) throw new Error("No DENTEX patients. Run npm run dentex:import first.");

  const rescore = process.argv.includes("--rescore");
  const tally = () => ({ matched: 0, missed: 0, extra: 0 });
  const scores = {
    all: { totals: tally(), fam: { caries: tally(), periapical: tally(), impacted: tally() } as Record<Family, ReturnType<typeof tally>> },
    agreed: { totals: tally(), fam: { caries: tally(), periapical: tally(), impacted: tally() } as Record<Family, ReturnType<typeof tally>> },
  };
  for (const p of patients) {
    const started = Date.now();
    const runId = rescore
      ? (await prisma.swarmRun.findFirst({ where: { patientId: p.id, kind: "diagnostic", status: { not: "running" } }, orderBy: { startedAt: "desc" }, select: { id: true } }))?.id
      : await startDiagnosticRun(p.id, { actor: "script:dentex-eval", wait: true });
    if (!runId) {
      console.log(`${p.id}  no run yet`);
      continue;
    }
    const run = await prisma.swarmRun.findUniqueOrThrow({ where: { id: runId }, include: { findings: true, study: true } });
    if (run.status === "failed") {
      console.log(`${p.id}  failed (not scored): ${String((run.summary as { error?: string })?.error ?? "").slice(0, 160)}`);
      continue;
    }
    const labels = (run.study?.labels as GroundTruth[] | null) ?? [];
    const toInput = (fs: typeof run.findings) => fs.map((f) => ({ teeth: f.teeth as number[], condition: f.condition }));
    const c = compareToGroundTruth(toInput(run.findings), labels);
    const agreed = compareToGroundTruth(toInput(run.findings.filter((f) => f.agreement >= 2)), labels);
    for (const [which, cmp] of [["all", c], ["agreed", agreed]] as const)
      for (const k of ["matched", "missed", "extra"] as const) {
        scores[which].totals[k] += cmp[k].length;
        for (const x of cmp[k]) scores[which].fam[x.family][k]++;
      }
    const list = (xs: { tooth: number; family: Family }[]) => xs.map((x) => `#${x.tooth} ${x.family}`).join(", ") || "none";
    console.log(`${p.id}  ${run.status}  found ${c.matched.length}/${c.matched.length + c.missed.length}  extra ${c.extra.length}  (${Math.round((Date.now() - started) / 1000)} s)`);
    console.log(`  missed: ${list(c.missed)}\n  extra:  ${list(c.extra)}`);
  }
  for (const [which, title] of [["all", "Every finding"], ["agreed", "Findings with ≥2/3 agreement"]] as const) {
    const { totals, fam } = scores[which];
    console.log(`\n${title}: recall ${pct(totals.matched, totals.matched + totals.missed)}  precision ${pct(totals.matched, totals.matched + totals.extra)}  (${totals.matched} found, ${totals.missed} missed, ${totals.extra} extra)`);
    for (const [k, v] of Object.entries(fam)) console.log(`  ${k.padEnd(11)} recall ${pct(v.matched, v.matched + v.missed).padStart(4)}  precision ${pct(v.matched, v.matched + v.extra).padStart(4)}  (${v.matched}/${v.matched + v.missed}, ${v.extra} extra)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

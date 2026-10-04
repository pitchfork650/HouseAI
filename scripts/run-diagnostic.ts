/** Dev helper: run the diagnostic swarm on one patient and wait for it. */
import { startDiagnosticRun } from "../src/lib/swarm/diagnostic/run";
import { prisma } from "../src/lib/db";

const patientId = process.argv[2] ?? "DX-38";
startDiagnosticRun(patientId, { actor: "script", wait: true }).then(async (runId) => {
  const run = await prisma.swarmRun.findUniqueOrThrow({ where: { id: runId }, include: { agents: { orderBy: { order: "asc" } }, findings: { orderBy: { order: "asc" } } } });
  console.log(run.id, run.status, `${Math.round(((run.finishedAt ?? new Date()).getTime() - run.startedAt.getTime()) / 1000)}s`);
  for (const a of run.agents) console.log(" ", a.name.padEnd(20), a.status.padEnd(6), a.badge.padEnd(18), a.model ?? "", a.status === "failed" ? a.result.slice(0, 120) : "");
  for (const f of run.findings) console.log("  F", (f.teeth as number[]).map((t) => `#${t}`).join(" "), f.priority, `${f.agreement}/3`, f.text);
  await prisma.$disconnect();
});

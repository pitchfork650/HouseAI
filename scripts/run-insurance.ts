/** Dev helper: run the insurance swarm for a patient and print the lanes. */
import { startInsuranceRun } from "../src/lib/swarm/insurance/run";
import { prisma } from "../src/lib/db";

const patientId = process.argv[2] ?? "P-1091";
startInsuranceRun(patientId, { background: false, actor: "script" }).then(async (runId) => {
  const agents = await prisma.agentRun.findMany({ where: { runId }, orderBy: { order: "asc" } });
  for (const a of agents) console.log(a.name.padEnd(26), a.badge.padEnd(12), (a.log as { text: string }[]).map((l) => l.text).join(" · "));
  const run = await prisma.swarmRun.findUniqueOrThrow({ where: { id: runId }, include: { estimates: true } });
  console.log(run.status, JSON.stringify(run.summary), run.estimates.map((e) => [e.primaryShare, e.secondaryShare, e.patientShare]));
  await prisma.$disconnect();
});

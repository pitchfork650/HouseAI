/** Dev helper: print every swarm run with its agents, findings and estimates. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  for (const r of await p.swarmRun.findMany({ include: { agents: { orderBy: { order: "asc" } }, findings: { orderBy: { order: "asc" } }, estimates: true }, orderBy: { startedAt: "asc" } })) {
    console.log(r.kind, r.patientId, r.status, JSON.stringify(r.summary));
    for (const a of r.agents) console.log(" ", a.name, "|", a.scope, "|", a.status, a.badge, "|", a.result, "|", (a.log as { t: string; text: string }[]).map((l) => l.t.slice(11, 16) + " " + l.text).join(" · "));
    for (const f of r.findings) console.log("  F", JSON.stringify(f.teeth), f.text, f.agreement, f.suggested, f.priority);
    for (const e of r.estimates) console.log("  E", e.label, e.primaryShare, e.secondaryShare, e.patientShare, e.secondaryStatus);
  }
  await p.$disconnect();
})();

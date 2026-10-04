import { prisma } from "./db";
import { audit } from "./audit";
import { procedureTitle } from "./rules/prioritize";

/**
 * Dentist accepts the swarm's suggested findings: each becomes a TreatmentItem
 * (linked to an existing booking when one already covers it) and every accept is audited.
 */
export async function acceptFindings(runId: string, actor = "user:dentist", findingIds?: string[]) {
  const run = await prisma.swarmRun.findUniqueOrThrow({ where: { id: runId }, include: { findings: true } });
  const pending = run.findings.filter((f) => f.status === "suggested" && (!findingIds || findingIds.includes(f.id)));
  const appts = await prisma.appointment.findMany({ where: { patientId: run.patientId, isHold: false } });
  let created = 0;
  for (const f of pending) {
    const teeth = f.teeth as number[];
    const booked = appts.find((a) => a.cdtCode === f.cdtCode || teeth.every((t) => new RegExp(`#${t}(?!\\d)`).test(a.title)));
    const item = await prisma.treatmentItem.create({
      data: {
        patientId: run.patientId,
        findingId: f.id,
        cdtCode: f.cdtCode,
        title: procedureTitle(f.cdtCode, teeth),
        teeth,
        durationMin: f.durationMin,
        visits: f.visits,
        priority: f.priority,
        prerequisite: f.prerequisite,
        status: booked ? "scheduled" : "planned",
      },
    });
    if (booked && !booked.treatmentItemId) await prisma.appointment.update({ where: { id: booked.id }, data: { treatmentItemId: item.id } });
    await prisma.finding.update({ where: { id: f.id }, data: { status: "accepted" } });
    await audit({ actor, action: "finding.accept", entity: "Finding", entityId: f.id, inputs: { runId, findingId: f.id }, outputs: { treatmentItemId: item.id } });
    created++;
  }
  return { created };
}

export async function rejectFinding(findingId: string, actor = "user:dentist", reason?: string) {
  const f = await prisma.finding.update({ where: { id: findingId }, data: { status: "rejected" } });
  await audit({ actor, action: "finding.reject", entity: "Finding", entityId: f.id, details: { reason: reason ?? null } });
  return f;
}

import { prisma } from "./db";
import { audit, hash } from "./audit";
import { erasePatientFiles } from "./storage";

/** GDPR right of access: everything held about one patient, as JSON. */
export async function exportPatient(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      consents: true,
      studies: { select: { id: true, type: true, takenAt: true, mimeType: true } },
      runs: { include: { agents: true, findings: true } },
      treatmentItems: true,
      appointments: true,
      policies: true,
      costEstimates: true,
      followUps: true,
      imagingOrders: true,
      documents: true,
      scheduleRequests: true,
    },
  });
  if (!patient) return null;
  await audit({ actor: "user:staff", action: "gdpr.export", entity: "Patient", entityId: hash(patientId) });
  return { exportedAt: new Date().toISOString(), patient };
}

/**
 * GDPR erasure: deletes the patient, everything linked to them (cascade) and their
 * encrypted files. The audit trail keeps only a hash of the patient id.
 */
export async function erasePatient(patientId: string) {
  const exists = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
  if (!exists) return false;
  await prisma.patient.delete({ where: { id: patientId } });
  await erasePatientFiles(patientId);
  await audit({ actor: "user:staff", action: "gdpr.erase", entity: "Patient", entityId: hash(patientId) });
  return true;
}

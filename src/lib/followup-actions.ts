import { prisma } from "./db";
import { audit } from "./audit";
import { mailer } from "./mail";
import { now } from "./clock";

async function hasEmailConsent(patientId: string) {
  const c = await prisma.consent.findFirst({ where: { patientId, purpose: "marketing_email" }, orderBy: { timestamp: "desc" } });
  return !!c?.granted;
}

export async function approveFollowUp(id: string, actor = "user:dentist") {
  const fu = await prisma.followUp.update({ where: { id }, data: { status: "approved" } });
  await audit({ actor, action: "followup.approve", entity: "FollowUp", entityId: id, outputs: { scheduledFor: fu.scheduledFor } });
  return fu;
}

/** Test send goes to the clinic, not the patient, so it doesn't need the patient's consent. */
export async function sendTest(id: string, actor = "user:dentist") {
  const fu = await prisma.followUp.findUniqueOrThrow({ where: { id } });
  const r = await mailer.send({ to: "care@[practice].com", subject: `[TEST] ${fu.subject}`, html: fu.html, tag: "test" });
  await audit({ actor, action: "followup.send_test", entity: "FollowUp", entityId: id, details: { messageId: r.id } });
  return r;
}

/**
 * Scheduler tick: send approved follow-ups that are due (only with email consent),
 * and the day-12 reminder when the patient hasn't booked.
 */
export async function processFollowUps(at: Date = now()) {
  let sent = 0, reminded = 0, skipped = 0;
  const due = await prisma.followUp.findMany({ where: { status: "approved", scheduledFor: { lte: at } }, include: { patient: true } });
  for (const fu of due) {
    if (!(await hasEmailConsent(fu.patientId))) {
      await prisma.followUp.update({ where: { id: fu.id }, data: { status: "skipped_no_consent" } });
      await audit({ actor: "scheduler", action: "followup.skip_no_consent", entity: "FollowUp", entityId: fu.id });
      skipped++;
      continue;
    }
    const r = await mailer.send({ to: fu.patient.email ?? "", subject: fu.subject, html: fu.html, tag: "aftercare" });
    await prisma.followUp.update({ where: { id: fu.id }, data: { status: "sent", sentAt: at } });
    await audit({ actor: "scheduler", action: "followup.sent", entity: "FollowUp", entityId: fu.id, details: { messageId: r.id } });
    sent++;
  }
  const reminders = await prisma.followUp.findMany({ where: { status: "sent", booked: false, reminderSentAt: null, reminderAt: { lte: at } }, include: { patient: true } });
  for (const fu of reminders) {
    if (!(await hasEmailConsent(fu.patientId))) continue;
    await mailer.send({ to: fu.patient.email ?? "", subject: `Reminder: ${fu.subject}`, html: fu.html, tag: "reminder-day-12" });
    await prisma.followUp.update({ where: { id: fu.id }, data: { reminderSentAt: at } });
    await audit({ actor: "scheduler", action: "followup.reminder", entity: "FollowUp", entityId: fu.id });
    reminded++;
  }
  return { sent, reminded, skipped };
}

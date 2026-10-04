import { prisma } from "./db";
import { audit } from "./audit";
import { mailer } from "./mail";
import { now } from "./clock";
import { testRecipient } from "./config";
import { computeReminderTime, computeSendTime, formatLength, generateEmail, renderEmailHtml, type VisitContext } from "./followup";

async function hasEmailConsent(patientId: string) {
  const c = await prisma.consent.findFirst({ where: { patientId, purpose: "marketing_email" }, orderBy: { timestamp: "desc" } });
  return !!c?.granted;
}

export async function approveFollowUp(id: string, actor = "user:dentist") {
  const fu = await prisma.followUp.update({ where: { id }, data: { status: "approved" } });
  await audit({ actor, action: "followup.approve", entity: "FollowUp", entityId: id, outputs: { scheduledFor: fu.scheduledFor } });
  return fu;
}

/** Test send goes to the TEST_EMAIL_TO address, never the patient, so it doesn't need the patient's consent. */
export async function sendTest(id: string, actor = "user:dentist") {
  const fu = await prisma.followUp.findUniqueOrThrow({ where: { id } });
  const r = await mailer.send({ to: testRecipient(), subject: `[TEST] ${fu.subject}`, html: fu.html, tag: "test" });
  await audit({ actor, action: "followup.send_test", entity: "FollowUp", entityId: id, details: { messageId: r.id, delivered: r.delivered } });
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

/**
 * Writes (or rewrites) a follow-up draft: model-written content when a key is set,
 * the procedure template otherwise. Only minimal visit context goes to the model.
 */
export async function draftFollowUp(o: { id: string; patientId: string; visitDate: string; visit: VisitContext; forceMock?: boolean }) {
  const email = await generateEmail(o.visit, o.forceMock);
  const video = await prisma.video.findUnique({ where: { procedure: o.visit.procedure } });
  const html = renderEmailHtml(email.data, {
    visitDate: o.visitDate,
    videoLength: video ? formatLength(video.lengthSec) : "",
    videoUrl: video?.url ?? "",
    bookUrl: `/schedule?book=${o.patientId}`,
    prefsUrl: `/preferences/${o.patientId}`,
  });
  const data = {
    patientId: o.patientId,
    procedure: o.visit.procedure,
    visitDate: o.visitDate,
    scheduledFor: computeSendTime(o.visitDate),
    reminderAt: computeReminderTime(o.visitDate),
    subject: email.data.subject,
    content: email.data,
    html,
    videoId: video?.id ?? null,
    status: "draft",
    model: email.model,
  };
  return prisma.followUp.upsert({ where: { id: o.id }, create: { id: o.id, ...data }, update: data });
}

/** Personalized demo follow-up for Gavin Huang (test recipient). */
export const GAVIN_FOLLOW_UP = {
  id: "FU-1120",
  patientId: "P-1120",
  visitDate: "2026-10-06",
  visit: { firstName: "Gavin", procedure: "Root canal", visitNotes: "Root canal on #30 (lower right first molar), completed in one visit. Temporary filling placed; crown to follow in 2-3 weeks. No complications.", teeth: "#30" },
};

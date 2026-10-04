/**
 * Seed: every screen shows exactly the sample content from the spec. The swarm
 * runs are produced by the real swarm code in mock mode (and a virtual clock for
 * the insurance lanes), so seeded data and live re-runs come from the same logic.
 */
import { PrismaClient } from "@prisma/client";
import { startDiagnosticRun } from "../src/lib/swarm/diagnostic/run";
import { startInsuranceRun } from "../src/lib/swarm/insurance/run";
import { VirtualClock } from "../src/lib/swarm/clock";
import { holdMeta } from "../src/lib/rules/schedule-rules";
import { PRACTICE } from "../src/lib/config";
import { computeReminderTime, computeSendTime, formatLength, generateEmail, renderEmailHtml } from "../src/lib/followup";
import { draftFollowUp, GAVIN_FOLLOW_UP } from "../src/lib/followup-actions";

process.env.MOCK_LATENCY_MS = "0";
process.env.GEMINI_API_KEY = ""; // the seed never calls a model
process.env.SWARM_HOST = "mock"; // seed runs replay the sample swarm runs

const prisma = new PrismaClient();
const DAY = "2026-10-06";
const at = (iso: string) => new Date(iso);
const h = (x: number) => Math.round(x * 60);

async function reset() {
  // Children first; cascades cover most of it.
  await prisma.auditEvent.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.video.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.scheduleRequest.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.swarmRun.deleteMany();
  await prisma.patient.deleteMany();
}

type P = { id: string; name: string; initials?: string; ageYears?: number; allergies?: string[]; insuranceNote?: string; email?: string };

async function patients() {
  const list: P[] = [
    { id: "P-1042", name: "Jordan M.", initials: "JM", ageYears: 34, allergies: ["Penicillin"] },
    { id: "P-1091", name: "Marcus T.", initials: "MT", insuranceNote: "changed jobs 2026-09" },
    { id: "P-1077", name: "Elena V.", initials: "EV" },
    { id: "P-1088", name: "Elena V.", initials: "EV" },
    { id: "P-1093", name: "Priya S.", initials: "PS" },
    { id: "P-1120", name: "Gavin Huang", initials: "GH", email: "gah016@ucsd.edu" },
    ...["P-1101", "P-1102", "P-1110", "P-1104", "P-1061", "P-0988", "P-1095", "P-1106", "P-1032", "P-1107", "P-1112", "P-1080", "P-1081", "P-1066", "P-1083", "P-1084", "P-1085", "P-1086", "P-1087", "P-1089"].map(
      (id) => ({ id, name: "[NAME]" }),
    ),
  ];
  for (const p of list) {
    await prisma.patient.create({
      data: {
        id: p.id,
        name: p.name,
        initials: p.initials ?? "··",
        dob: "[DATE]",
        ageYears: p.ageYears ?? null,
        email: p.email ?? "[EMAIL]",
        allergies: p.allergies ?? [],
        premedicationRequired: false,
        flags: [],
        insuranceNote: p.insuranceNote ?? null,
        synthetic: true,
        consents: {
          create: [
            { purpose: "treatment", granted: true, recordRef: "[ID]", timestamp: at("2026-09-01T09:00:00Z") },
            { purpose: "ai_analysis", granted: true, recordRef: "[ID]", timestamp: at("2026-09-01T09:00:00Z") },
            ...(p.id === "P-1077" || p.id === "P-1120" ? [{ purpose: "marketing_email", granted: true, recordRef: "[ID]", timestamp: at("2026-09-01T09:00:00Z") }] : []),
          ],
        },
      },
    });
  }
}

async function imaging() {
  await prisma.imagingStudy.createMany({
    data: [
      // Jordan: earlier recall set (2025-03) and the current visit (2026-10-02).
      { patientId: "P-1042", type: "pano", takenAt: at("2025-03-14T10:05:00Z"), fileUrl: "synthetic:pano-2025" },
      { patientId: "P-1042", type: "bitewing", takenAt: at("2025-03-14T10:08:00Z"), fileUrl: "synthetic:bitewing-2025" },
      { patientId: "P-1042", type: "pano", takenAt: at("2026-10-02T09:12:00Z"), fileUrl: "synthetic:pano" },
      { patientId: "P-1042", type: "bitewing", takenAt: at("2026-10-02T09:15:00Z"), fileUrl: "synthetic:bitewing" },
      // Marcus: pano + bitewings to attach to the pre-approval.
      { patientId: "P-1091", type: "pano", takenAt: at("2026-09-28T14:20:00Z"), fileUrl: "synthetic:pano" },
      { patientId: "P-1091", type: "bitewing", takenAt: at("2026-09-28T14:24:00Z"), fileUrl: "synthetic:bitewing" },
      // Elena (P-1088): last X-ray older than 12 months, so she's blocked.
      { patientId: "P-1088", type: "bitewing", takenAt: at("2024-08-20T11:00:00Z"), fileUrl: "synthetic:bitewing" },
    ],
  });
}

/** The 2025-03 recall run for P-1042: the baseline the current X-rays are compared against. */
async function earlierDiagnosticRun() {
  const study = await prisma.imagingStudy.findFirstOrThrow({ where: { patientId: "P-1042", type: "pano", takenAt: { lt: at("2026-01-01T00:00:00Z") } } });
  const findings = [
    { teeth: [3], condition: "caries_enamel", text: "Early enamel cavity, not into the dentin yet", cdtCode: "D1206", suggested: "D1206 · 10 min", durationMin: 10, priority: "P4" },
    { teeth: [12], condition: "caries_enamel", text: "Early enamel cavity, not into the dentin yet", cdtCode: "D1206", suggested: "D1206 · 10 min", durationMin: 10, priority: "P4" },
    { teeth: [32], condition: "impacted_complete_bony", text: "Impacted wisdom tooth (completely bony), roots on the nerve canal", cdtCode: "D7240", suggested: "D7240 · 60 min (D0367 CBCT first)", durationMin: 60, priority: "P2" },
    { teeth: [17], condition: "impacted_partial_bony", text: "Impacted wisdom tooth (partially bony)", cdtCode: "D7230", suggested: "D7230 · 45 min", durationMin: 45, priority: "P2" },
  ];
  await prisma.swarmRun.create({
    data: {
      kind: "diagnostic",
      patientId: "P-1042",
      studyId: study.id,
      status: "done",
      startedAt: at("2025-03-14T10:10:00Z"),
      finishedAt: at("2025-03-14T10:10:16Z"),
      summary: { reported: 6, total: 7, note: "Baseline recall run." },
      findings: { create: findings.map((f, i) => ({ ...f, order: i, reporter: "seed", agreement: 3, overlay: [], status: "accepted" })) },
    },
  });
}

async function diagnosticRun() {
  const runId = await startDiagnosticRun("P-1042", { actor: "seed", wait: true });
  // Place the seeded run at the time of the X-ray, 14 s long.
  const start = at("2026-10-02T09:13:05Z");
  const end = new Date(start.getTime() + 14_000);
  await prisma.swarmRun.update({ where: { id: runId }, data: { startedAt: start, finishedAt: end } });
  const agents = await prisma.agentRun.findMany({ where: { runId } });
  for (const a of agents) {
    const phase2 = a.name === "Verifier" || a.name === "Skeptic";
    const t0 = new Date(start.getTime() + (phase2 ? 8_000 : 0));
    const t1 = new Date(start.getTime() + (phase2 ? 13_000 : 3_000 + a.order * 1_000));
    const log = (a.log as { t: string; text: string }[]).map((l, i, all) => ({ ...l, t: new Date(t0.getTime() + ((t1.getTime() - t0.getTime()) * i) / Math.max(1, all.length - 1)).toISOString() }));
    await prisma.agentRun.update({ where: { id: a.id }, data: { startedAt: t0, finishedAt: t1, log } });
  }
}

async function insurance() {
  await prisma.insurancePolicy.createMany({
    data: [
      { patientId: "P-1091", carrier: "Carrier A", planName: "New employer PPO", memberId: "[ID]", groupNumber: "[#]", rank: "primary", status: "unverified" },
      { patientId: "P-1091", carrier: "Carrier B", planName: "Spouse plan (secondary)", memberId: "[ID]", groupNumber: "[#]", rank: "secondary", status: "changed", secondaryShareOfRemainder: 0.5 },
    ],
  });
  await prisma.documentScan.create({
    data: {
      patientId: "P-1091",
      kind: "insurance_card",
      scannedAt: at("2026-10-04T09:40:00Z"),
      status: "confirmed",
      fields: {
        name: { value: "Marcus T.", confidence: 0.97, confirmed: true },
        dob: { value: "[DATE]", confidence: 0.93, confirmed: true },
        memberId: { value: "[ID]", confidence: 0.74, confirmed: true },
        groupNumber: { value: "[#]", confidence: 0.91, confirmed: true },
        carrier: { value: "Carrier A", confidence: 0.98, confirmed: true },
      },
    },
  });
  await prisma.treatmentItem.create({
    data: { patientId: "P-1091", cdtCode: "D6010", title: "Implant #19", teeth: [19], durationMin: 75, priority: "P2", requiresInsurance: true, status: "planned" },
  });
  await startInsuranceRun("P-1091", { clock: new VirtualClock(Date.parse("2026-10-04T09:40:00Z")), background: false, actor: "seed" });
}

async function schedule() {
  await prisma.provider.createMany({
    data: [
      { id: "LD", name: PRACTICE.doctorName, initials: PRACTICE.signedInInitials, chair: "Chair 1 · cosmetic", order: 0, skills: ["cosmetic", "restorative", "consult", "checkup", "emergency", "post-op"] },
      { id: "AS", name: "Dr. [ASSOCIATE]", initials: "AS", chair: "Chair 2 · surgery", order: 1, skills: ["surgery", "endo", "implant", "restorative", "cosmetic", "checkup", "emergency", "consult"] },
      { id: "HY", name: "[HYGIENIST]", initials: "HY", chair: "Hygiene", order: 2, workEnd: 16 * 60, skills: ["hygiene"] },
    ],
  });

  type B = [start: number, end: number, title: string, meta: string, prio: string, extra?: { patientId?: string; cdt?: string; hold?: boolean; source?: string }];
  const pid = (meta: string) => meta.match(/P-\d{4}/)?.[0];
  const blocks: Record<string, B[]> = {
    LD: [
      [8, 11, "Porcelain veneers ×8", "P-1077 · #5–#12 · [$ VALUE]", "P2", { cdt: "D2962" }],
      [11, 11.5, "Emergency hold", holdMeta(), "P1", { hold: true }],
      [11.5, 12, "Crown seat #14", "P-1042", "P3", { cdt: "D2740" }],
      [13, 13.75, "Composite #3, #19", "P-1042 · from swarm", "P3", { cdt: "D2391", source: "swarm" }],
      [13.75, 14, "Checkup", "P-1101", "P4", { source: "import" }],
      [14, 14.25, "Checkup", "P-1102", "P4", { source: "import" }],
      [14.5, 15.5, "Smile design consult", "P-1110 · cosmetic", "P3"],
      [15.5, 15.75, "Checkup", "P-1104", "P4", { source: "import" }],
      [16, 16.25, "Post-op check", "P-1061", "P4"],
    ],
    AS: [
      [8, 9.5, "Wisdom teeth #17, #32", "P-1042 · CBCT done", "P2", { cdt: "D7240" }],
      [9.5, 10.75, "Root canal #30", "P-1042 · after PA film", "P1", { cdt: "D3330" }],
      [10.75, 12, "Implant placement #19", "P-0988", "P2", { cdt: "D6010" }],
      [13, 13.5, "Filling #30 (temporary)", "P-1095", "P3"],
      [13.5, 13.75, "Checkup", "P-1106", "P4", { source: "import" }],
      [14, 15, "Crown prep #3", "P-1032", "P3"],
      [15, 15.25, "Checkup", "P-1107", "P4", { source: "import" }],
      [15.5, 16.5, "Whitening", "P-1112 · cosmetic", "P3"],
    ],
    HY: [
      [8, 8.75, "Cleaning + exam", "P-1080", "P4", { source: "import" }],
      [8.75, 9.5, "Cleaning + exam", "P-1081", "P4", { source: "import" }],
      [9.5, 10.5, "Deep cleaning (SRP)", "P-1066 · bone loss", "P3"],
      [10.5, 11.25, "Cleaning + exam", "P-1083", "P4", { source: "import" }],
      [11.25, 12, "Cleaning + exam", "P-1084", "P4", { source: "import" }],
      [13, 13.75, "Cleaning + exam", "P-1085", "P4", { source: "import" }],
      [13.75, 14.5, "Cleaning + exam", "P-1086", "P4", { source: "import" }],
      [14.5, 15.25, "Cleaning + bitewings", "P-1087", "P4"],
      [15.25, 16, "Cleaning + exam", "P-1089", "P4"],
    ],
  };

  const batch = "import-2026-10-06";
  for (const [providerId, list] of Object.entries(blocks)) {
    for (const [s, e, title, meta, prio, x] of list) {
      const patientId = x?.hold ? null : pid(meta) ?? null;
      const appt = await prisma.appointment.create({
        data: { providerId, patientId, date: DAY, startMin: h(s), endMin: h(e), title, meta, priority: prio, cdtCode: x?.cdt ?? null, isHold: !!x?.hold, source: x?.source ?? "manual" },
      });
      if (x?.source === "import" && patientId) {
        const isCleaning = title.startsWith("Cleaning");
        await prisma.scheduleRequest.create({
          data: { batch, patientId, name: "[NAME]", procedureCode: isCleaning ? "D1110" : "D0120", procedure: title, durationMin: h(e) - h(s), priority: prio, status: "placed", appointmentId: appt.id },
        });
      }
    }
  }
  // The 3 blocked rows from the same import (14 imported · 11 placed · 3 blocked).
  await prisma.scheduleRequest.createMany({
    data: [
      { batch, patientId: "P-1088", name: "Elena V.", procedureCode: "D2962", procedure: "8-unit veneer prep", durationMin: 180, priority: "P2", status: "blocked", blocker: "No X-ray from the last 12 months on file" },
      { batch, patientId: "P-1091", name: "Marcus T.", procedureCode: "D9310", procedure: "Implant consult", durationMin: 45, priority: "P3", status: "blocked", blocker: "Insurance changed: waiting on swarm" },
      { batch, patientId: "P-1093", name: "Priya S.", procedureCode: "D1110", procedure: "Cleaning + exam", durationMin: 45, priority: "P4", earliest: 15 * 60, status: "blocked", blocker: "Can only come after 3 pm" },
    ],
  });
}

async function followUps() {
  const videos = [
    ["veneers", "Porcelain veneers", "Caring for new veneers: the first 14 days", 58],
    ["wisdom", "Wisdom tooth extraction", "Healing after wisdom tooth removal", 72],
    ["root-canal", "Root canal", "After a root canal: the next steps", 47],
    ["crown-seat", "Crown seat", "Your new crown", 40],
    ["whitening", "Whitening", "After whitening", 35],
    ["checkup", "Checkup + cleaning", "Your checkup and cleaning", 25],
  ] as const;
  for (const [i, [id, procedure, title, len]] of videos.entries()) {
    await prisma.video.create({ data: { id, procedure, title, lengthSec: len, url: `/videos/${id}`, order: i } });
  }

  const visit = { firstName: "Elena", procedure: "Porcelain veneers", visitNotes: "Porcelain veneers ×8 bonded, #5–#12. No complications.", teeth: "#5–#12", count: 8 };
  const email = await generateEmail(visit, true);
  const video = await prisma.video.findUniqueOrThrow({ where: { procedure: visit.procedure } });
  const html = renderEmailHtml(email.data, { visitDate: DAY, videoLength: formatLength(video.lengthSec), videoUrl: video.url, bookUrl: "/schedule?book=P-1077", prefsUrl: "/preferences/P-1077" });
  await prisma.followUp.create({
    data: {
      id: "FU-1077",
      patientId: "P-1077",
      procedure: visit.procedure,
      visitDate: DAY,
      scheduledFor: computeSendTime(DAY),
      reminderAt: computeReminderTime(DAY),
      subject: email.data.subject,
      content: email.data,
      html,
      videoId: video.id,
      status: "draft",
      model: email.model,
    },
  });

  // Template draft here (the seed never calls a model); `npm run followup:draft FU-1120` rewrites it with Gemini.
  await draftFollowUp({ ...GAVIN_FOLLOW_UP, forceMock: true });
}

async function main() {
  await reset();
  await patients();
  await imaging();
  await earlierDiagnosticRun();
  await diagnosticRun();
  await insurance();
  await schedule();
  await followUps();
  const counts = await Promise.all([prisma.patient.count(), prisma.appointment.count(), prisma.finding.count(), prisma.agentRun.count(), prisma.auditEvent.count()]);
  console.log(`Seeded: ${counts[0]} patients, ${counts[1]} appointments, ${counts[2]} findings, ${counts[3]} agent runs, ${counts[4]} audit events.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

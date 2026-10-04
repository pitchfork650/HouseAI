import { prisma } from "./db";
import { audit } from "./audit";
import { now } from "./clock";
import { asPriority, type Priority } from "./priority";
import { autofill, type AFItem, type InsuranceStatus } from "./rules/autofill";
import { SCHEDULE_RULES, holdMeta } from "./rules/schedule-rules";

export const DEFAULT_DAY = process.env.SCHEDULE_DEFAULT_DATE ?? "2026-10-06";

const PROCEDURE_NAMES: Record<string, string> = {
  D0120: "Checkup", D0150: "New patient exam", D1110: "Cleaning + exam", D4341: "Deep cleaning (SRP)",
  D2391: "Composite", D2740: "Crown", D2962: "Veneers", D3330: "Root canal", D6010: "Implant placement",
  D7230: "Wisdom tooth removal", D7240: "Wisdom tooth removal", D9310: "Consult", D9972: "Whitening",
};
export const procedureName = (code: string) => PROCEDURE_NAMES[code] ?? code;

export function durationLabel(min: number): string {
  return min >= 60 && min % 60 === 0 ? `${min / 60} h` : `${min} min`;
}

/** Days from `date` through Friday of the same week. */
export function weekDays(date: string): string[] {
  const d = new Date(`${date}T00:00:00Z`);
  const out: string[] = [];
  for (let x = new Date(d); x.getUTCDay() !== 6 && x.getUTCDay() !== 0; x.setUTCDate(x.getUTCDate() + 1)) out.push(x.toISOString().slice(0, 10));
  return out.length ? out : [date];
}

async function insuranceStatusFor(patientId: string): Promise<InsuranceStatus> {
  const policies = await prisma.insurancePolicy.findMany({ where: { patientId } });
  if (!policies.length) return "none";
  if (policies.every((p) => p.status === "verified")) return "verified";
  const run = await prisma.swarmRun.findFirst({ where: { patientId, kind: "insurance" }, orderBy: { startedAt: "desc" } });
  return !run || run.status === "running" || run.status === "partial" || policies.some((p) => p.status === "changed") ? "waiting_swarm" : "pending";
}

async function lastXray(patientId: string): Promise<Date | null> {
  const s = await prisma.imagingStudy.findFirst({ where: { patientId, type: { in: ["pano", "bitewing", "pa", "cbct"] } }, orderBy: { takenAt: "desc" } });
  return s?.takenAt ?? null;
}

/** Planned treatment items join the queue as schedule requests. */
async function queueTreatmentPlan() {
  const items = await prisma.treatmentItem.findMany({ where: { status: "planned" } });
  for (const t of items) {
    const exists = await prisma.scheduleRequest.findFirst({ where: { treatmentItemId: t.id } });
    if (exists) continue;
    await prisma.scheduleRequest.create({
      data: {
        batch: "treatment-plan",
        patientId: t.patientId,
        name: (await prisma.patient.findUnique({ where: { id: t.patientId } }))?.name ?? "[NAME]",
        procedureCode: t.cdtCode,
        procedure: t.title,
        durationMin: t.durationMin,
        priority: t.priority,
        status: "pending",
        treatmentItemId: t.id,
      },
    });
  }
}

/**
 * Auto-fill the given days: pending and blocked requests are run through the
 * pure autofill() day by day; placements become appointments.
 */
export async function autofillDays(days: string[], actor = "user:staff") {
  await queueTreatmentPlan();
  const providers = await prisma.provider.findMany({ orderBy: { order: "asc" } });
  let placedTotal = 0;
  let holdsTotal = 0;
  for (const date of days) {
    const requests = await prisma.scheduleRequest.findMany({ where: { status: { in: ["pending", "blocked"] } } });
    if (!requests.length) break;
    const items: AFItem[] = [];
    for (const r of requests) {
      items.push({
        id: r.id,
        patientId: r.patientId,
        code: r.procedureCode,
        durationMin: r.durationMin,
        priority: asPriority(r.priority),
        earliest: r.earliest,
        latest: r.latest,
        insuranceStatus: await insuranceStatusFor(r.patientId),
        lastXrayAt: await lastXray(r.patientId),
      });
    }
    const bookings = await prisma.appointment.findMany({ where: { date } });
    const res = autofill({
      date,
      now: now(),
      items,
      providers: providers.map((p) => ({ id: p.id, skills: p.skills as string[], workStart: p.workStart, workEnd: p.workEnd })),
      bookings: bookings.map((b) => ({ providerId: b.providerId, startMin: b.startMin, endMin: b.endMin, isHold: b.isHold })),
    });
    for (const h of res.holds) {
      await prisma.appointment.create({ data: { providerId: h.providerId, date, startMin: h.startMin, endMin: h.endMin, title: "Emergency hold", meta: holdMeta(), priority: "P1", isHold: true, source: "autofill" } });
      holdsTotal++;
    }
    for (const p of res.placed) {
      const r = requests.find((x) => x.id === p.itemId)!;
      const fromSwarm = !!r.treatmentItemId && !!(await prisma.treatmentItem.findUnique({ where: { id: r.treatmentItemId } }))?.findingId;
      const appt = await prisma.appointment.create({
        data: {
          providerId: p.providerId,
          patientId: r.patientId,
          treatmentItemId: r.treatmentItemId,
          date,
          startMin: p.startMin,
          endMin: p.endMin,
          title: r.procedure,
          meta: `${r.patientId}${fromSwarm ? " · from swarm" : ""}`,
          priority: r.priority,
          cdtCode: r.procedureCode,
          source: "autofill",
        },
      });
      await prisma.scheduleRequest.update({ where: { id: r.id }, data: { status: "placed", blocker: null, appointmentId: appt.id } });
      if (r.treatmentItemId) await prisma.treatmentItem.update({ where: { id: r.treatmentItemId }, data: { status: "scheduled" } });
      placedTotal++;
    }
    for (const u of res.unplaced) await prisma.scheduleRequest.update({ where: { id: u.itemId }, data: { status: "blocked", blocker: u.reason } });
  }
  const blocked = await prisma.scheduleRequest.count({ where: { status: "blocked" } });
  await audit({ actor, action: "schedule.autofill", details: { days, placed: placedTotal, holds: holdsTotal, blocked } });
  return { placed: placedTotal, holds: holdsTotal, blocked };
}

export type CsvRow = { patient_id: string; name: string; procedure_code: string; duration_min: number; priority: Priority; earliest: number | null; latest: number | null };

function parseTime(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) throw new Error(`Bad time "${v}"`);
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3]?.toLowerCase() === "pm" && h < 12) h += 12;
  if (m[3]?.toLowerCase() === "am" && h === 12) h = 0;
  return h * 60 + min;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const COLUMNS = ["patient_id", "name", "procedure_code", "duration_min", "priority", "earliest", "latest"] as const;

/** CSV import: patient_id, name, procedure_code, duration_min, priority, earliest, latest. */
export function parseScheduleCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], errors: ["Empty file"] };
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const missing = COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], errors: [`Missing columns: ${missing.join(", ")}`] };
  const idx = Object.fromEntries(COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof COLUMNS)[number], number>;
  const rows: CsvRow[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, i) => {
    const f = splitCsvLine(line);
    try {
      const priority = f[idx.priority].toUpperCase();
      if (!["P1", "P2", "P3", "P4"].includes(priority)) throw new Error(`priority must be P1–P4`);
      const duration = Number(f[idx.duration_min]);
      if (!Number.isFinite(duration) || duration <= 0 || duration % 15) throw new Error("duration_min must be a positive multiple of 15");
      if (!f[idx.patient_id]) throw new Error("patient_id is required");
      rows.push({
        patient_id: f[idx.patient_id],
        name: f[idx.name] || "[NAME]",
        procedure_code: f[idx.procedure_code].toUpperCase(),
        duration_min: duration,
        priority: priority as Priority,
        earliest: parseTime(f[idx.earliest] ?? ""),
        latest: parseTime(f[idx.latest] ?? ""),
      });
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : e}`);
    }
  });
  return { rows, errors };
}

export async function importCsv(text: string, actor = "user:staff") {
  const { rows, errors } = parseScheduleCsv(text);
  const batch = `import-${now().toISOString()}`;
  for (const r of rows) {
    await prisma.patient.upsert({
      where: { id: r.patient_id },
      update: {},
      // Imported records are real patient data: never sent to a model outside production.
      create: { id: r.patient_id, name: r.name, initials: r.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(), allergies: [], flags: [], synthetic: false },
    });
    await prisma.scheduleRequest.create({
      data: { batch, patientId: r.patient_id, name: r.name, procedureCode: r.procedure_code, procedure: procedureName(r.procedure_code), durationMin: r.duration_min, priority: r.priority, earliest: r.earliest, latest: r.latest, status: "pending" },
    });
  }
  await audit({ actor, action: "schedule.import_csv", details: { batch, rows: rows.length, errors: errors.length } });
  return { batch, imported: rows.length, errors };
}

/** Everything the Schedule screen shows for one day. */
export async function scheduleView(date: string) {
  const [providers, appts, requests] = await Promise.all([
    prisma.provider.findMany({ orderBy: { order: "asc" } }),
    prisma.appointment.findMany({ where: { date }, orderBy: { startMin: "asc" } }),
    prisma.scheduleRequest.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const real = appts.filter((a) => !a.isHold);
  const stats = {
    placed: real.length,
    longBeforeNoon: real.filter((a) => a.priority === "P2" && a.startMin < SCHEDULE_RULES.noon).length,
    holds: appts.filter((a) => a.isHold).length,
    needInput: requests.filter((r) => r.status === "blocked").length,
  };
  return {
    providers,
    appts,
    stats,
    queue: requests.filter((r) => r.status === "blocked"),
    counts: { imported: requests.length, placed: requests.filter((r) => r.status === "placed").length, blocked: stats.needInput },
  };
}

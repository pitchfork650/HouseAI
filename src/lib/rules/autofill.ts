import type { Priority } from "../priority";
import { SCHEDULE_RULES } from "./schedule-rules";

/**
 * Calendar builder. Pure and deterministic: given treatment items, providers,
 * existing bookings and the rules, returns placed blocks plus an unplaced list
 * with reasons. Persisting the result is the caller's job.
 */
export type AFProvider = { id: string; skills: string[]; workStart: number; workEnd: number };
export type AFBooking = { providerId: string; startMin: number; endMin: number; isHold?: boolean };
export type InsuranceStatus = "verified" | "pending" | "waiting_swarm" | "none";
export type AFItem = {
  id: string;
  patientId: string;
  code: string;
  durationMin: number;
  priority: Priority;
  earliest?: number | null; // minutes from midnight
  latest?: number | null; // latest end time
  insuranceStatus: InsuranceStatus;
  lastXrayAt: Date | null;
};
export type AFRules = typeof SCHEDULE_RULES;
export type AFInput = { date: string; now: Date; items: AFItem[]; providers: AFProvider[]; bookings: AFBooking[]; rules?: AFRules };
export type AFPlaced = { itemId: string; providerId: string; startMin: number; endMin: number };
export type AFResult = { placed: AFPlaced[]; holds: AFBooking[]; unplaced: { itemId: string; reason: string }[] };

/** Which provider skill a procedure needs. */
export const SKILL_BY_CODE: Record<string, string> = {
  D0120: "checkup", D0150: "checkup", D1110: "hygiene", D4341: "hygiene", D0220: "checkup",
  D2391: "restorative", D2740: "restorative", D2962: "cosmetic", D9972: "cosmetic", D9310: "consult",
  D3310: "endo", D3320: "endo", D3330: "endo", D6010: "implant", D7220: "surgery", D7230: "surgery", D7240: "surgery",
};
/** Procedures that need insurance verified before booking. */
export const INSURANCE_CODES = new Set(["D6010", "D2740", "D3310", "D3320", "D3330", "D7220", "D7230", "D7240", "D9310"]);
/** Procedures that need an X-ray from the last 12 months. */
export const XRAY_CODES = new Set(["D2391", "D2740", "D2962", "D3310", "D3320", "D3330", "D6010", "D7220", "D7230", "D7240", "D9310"]);

const SLOT = 15;
const PRIO_RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

export function timeLabel(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
}

export function blockerFor(item: AFItem, date: string, now: Date, rules: AFRules = SCHEDULE_RULES): string | null {
  const day = new Date(`${date}T00:00:00Z`);
  if (XRAY_CODES.has(item.code) && (!item.lastXrayAt || monthsBetween(item.lastXrayAt, day) >= rules.xrayMaxAgeMonths)) {
    return `No X-ray from the last ${rules.xrayMaxAgeMonths} months on file`;
  }
  if (INSURANCE_CODES.has(item.code) && item.insuranceStatus !== "verified") {
    const firstSlot = new Date(day.getTime() + Math.max(rules.dayStart, item.earliest ?? 0) * 60_000);
    const hours = (firstSlot.getTime() - now.getTime()) / 3_600_000;
    if (hours < rules.insuranceLeadHours) {
      return item.insuranceStatus === "waiting_swarm" ? "Insurance changed: waiting on swarm" : `Insurance not verified ${rules.insuranceLeadHours} h before`;
    }
  }
  return null;
}

export function autofill({ date, now, items, providers, bookings, rules = SCHEDULE_RULES }: AFInput): AFResult {
  const busy = new Map<string, [number, number][]>(providers.map((p) => [p.id, [[rules.lunch.start, rules.lunch.end]]]));
  for (const b of bookings) busy.get(b.providerId)?.push([b.startMin, b.endMin]);
  const free = (pid: string, s: number, e: number) => !busy.get(pid)!.some(([bs, be]) => s < be && e > bs);
  const holds: AFBooking[] = [];

  // One P1 emergency hold per day.
  if (!bookings.some((b) => b.isHold)) {
    const p = providers.find((x) => x.skills.includes("emergency") && free(x.id, rules.hold.start, rules.hold.end));
    if (p) {
      const h = { providerId: p.id, startMin: rules.hold.start, endMin: rules.hold.end, isHold: true };
      holds.push(h);
      busy.get(p.id)!.push([h.startMin, h.endMin]);
    }
  }

  const isLong = (i: AFItem) => i.durationMin >= rules.longCaseMin;
  const queue = [...items].sort(
    (a, b) =>
      (a.priority === "P1" ? 0 : 1) - (b.priority === "P1" ? 0 : 1) ||
      (isLong(b) ? 1 : 0) - (isLong(a) ? 1 : 0) ||
      PRIO_RANK[a.priority] - PRIO_RANK[b.priority] ||
      b.durationMin - a.durationMin ||
      a.id.localeCompare(b.id),
  );

  const placed: AFPlaced[] = [];
  const unplaced: AFResult["unplaced"] = [];

  const findSlot = (item: AFItem, respectWindow: boolean) => {
    const skill = SKILL_BY_CODE[item.code] ?? "restorative";
    const candidates = providers.filter((p) => p.skills.includes(skill));
    const lo = respectWindow ? Math.max(rules.dayStart, item.earliest ?? 0) : rules.dayStart;
    let hi = respectWindow && item.latest ? Math.min(rules.dayEnd, item.latest) : rules.dayEnd;
    if (isLong(item)) hi = Math.min(hi, rules.noon); // long cases before noon
    const starts: number[] = [];
    for (let s = lo; s + item.durationMin <= hi; s += SLOT) starts.push(s);
    // Checkups fill the afternoon gaps first.
    if (item.priority === "P4") starts.sort((a, b) => (a >= rules.lunch.end ? 0 : 1) - (b >= rules.lunch.end ? 0 : 1) || a - b);
    for (const s of starts) {
      for (const p of candidates) {
        const e = s + item.durationMin;
        if (s >= p.workStart && e <= p.workEnd && free(p.id, s, e)) return { providerId: p.id, startMin: s, endMin: e };
      }
    }
    return null;
  };

  for (const item of queue) {
    const blocked = blockerFor(item, date, now, rules);
    if (blocked) {
      unplaced.push({ itemId: item.id, reason: blocked });
      continue;
    }
    const slot = findSlot(item, true);
    if (slot) {
      placed.push({ itemId: item.id, ...slot });
      busy.get(slot.providerId)!.push([slot.startMin, slot.endMin]);
      continue;
    }
    let reason: string;
    if (item.earliest && item.earliest > rules.dayStart) reason = `Can only come after ${timeLabel(item.earliest)}`;
    else if (item.latest && item.latest < rules.dayEnd) reason = `Can only come before ${timeLabel(item.latest)}`;
    else if (isLong(item)) reason = "No morning slot long enough";
    else reason = "No free slot that day";
    unplaced.push({ itemId: item.id, reason });
  }
  return { placed, holds, unplaced };
}

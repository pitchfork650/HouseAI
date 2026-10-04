/**
 * Clinic clock. All DateTime values are clinic wall-clock times stored as UTC,
 * so formatting always uses timeZone "UTC". DEMO_NOW pins "now" for the seed demo.
 */
export function now(): Date {
  const pinned = process.env.DEMO_NOW;
  if (pinned) {
    // Advance from the pinned instant by real elapsed time so log lines still tick.
    const base = Date.parse(pinned);
    if (!Number.isNaN(base)) return new Date(base + (Date.now() - bootTime));
  }
  return new Date();
}
const bootTime = Date.now();

export function hhmm(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toISOString().slice(11, 16);
}

export function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h > 12 ? h - 12 : h;
  return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "am" : "pm"}`;
}

export function dateFromISODate(date: string, minutes = 0): Date {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() + minutes * 60_000);
}

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "TUESDAY · OCT 6" */
export function dayEyebrow(date: string): string {
  const d = dateFromISODate(date);
  return `${DAYS[d.getUTCDay()]} · ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "WED 9:00 AM" */
export function sendLabel(d: Date): string {
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${DAYS[d.getUTCDay()].slice(0, 3)} ${h12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

/** "Oct 6" */
export function shortDate(date: string): string {
  const d = dateFromISODate(date);
  const m = MONTHS[d.getUTCMonth()];
  return `${m[0]}${m.slice(1).toLowerCase()} ${d.getUTCDate()}`;
}

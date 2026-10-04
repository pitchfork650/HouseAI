import { describe, expect, it } from "vitest";
import { autofill, blockerFor, type AFItem, type AFProvider } from "@/lib/rules/autofill";
import { parseScheduleCsv, weekDays } from "@/lib/schedule";

const providers: AFProvider[] = [
  { id: "LD", skills: ["cosmetic", "restorative", "consult", "checkup", "emergency"], workStart: 480, workEnd: 1020 },
  { id: "AS", skills: ["surgery", "endo", "implant", "restorative", "checkup", "emergency", "consult"], workStart: 480, workEnd: 1020 },
  { id: "HY", skills: ["hygiene"], workStart: 480, workEnd: 960 },
];
const now = new Date("2026-10-04T10:00:00Z");
const recent = new Date("2026-09-01T00:00:00Z");
const item = (o: Partial<AFItem> & { id: string; code: string; durationMin: number }): AFItem => ({
  patientId: "P", priority: "P3", insuranceStatus: "verified", lastXrayAt: recent, ...o,
});

describe("auto-fill", () => {
  it("holds one P1 emergency slot at 11:00–11:30", () => {
    const r = autofill({ date: "2026-10-06", now, items: [], providers, bookings: [] });
    expect(r.holds).toEqual([{ providerId: "LD", startMin: 660, endMin: 690, isHold: true }]);
    const again = autofill({ date: "2026-10-06", now, items: [], providers, bookings: [{ providerId: "LD", startMin: 660, endMin: 690, isHold: true }] });
    expect(again.holds).toEqual([]);
  });

  it("puts cases of 90 min or more before noon, and checkups in the afternoon", () => {
    const r = autofill({
      date: "2026-10-06", now, providers, bookings: [],
      items: [item({ id: "veneers", code: "D2962", durationMin: 180, priority: "P2" }), item({ id: "check", code: "D0120", durationMin: 15, priority: "P4" })],
    });
    const v = r.placed.find((p) => p.itemId === "veneers")!;
    expect(v.endMin).toBeLessThanOrEqual(720);
    expect(r.placed.find((p) => p.itemId === "check")!.startMin).toBeGreaterThanOrEqual(780);
  });

  it("blocks without an X-ray in 12 months, and unverified insurance under 48 h", () => {
    expect(blockerFor(item({ id: "a", code: "D2962", durationMin: 180, lastXrayAt: new Date("2024-08-20T00:00:00Z") }), "2026-10-06", now)).toBe("No X-ray from the last 12 months on file");
    expect(blockerFor(item({ id: "b", code: "D9310", durationMin: 45, insuranceStatus: "waiting_swarm" }), "2026-10-06", now)).toBe("Insurance changed: waiting on swarm");
    expect(blockerFor(item({ id: "c", code: "D9310", durationMin: 45, insuranceStatus: "pending" }), "2026-10-08", now)).toBeNull();
  });

  it("respects patient time windows and reports them", () => {
    const full = [{ providerId: "HY", startMin: 480, endMin: 960 }];
    const r = autofill({ date: "2026-10-06", now, providers, bookings: full, items: [item({ id: "priya", code: "D1110", durationMin: 45, priority: "P4", earliest: 900 })] });
    expect(r.unplaced).toEqual([{ itemId: "priya", reason: "Can only come after 3 pm" }]);
    const open = autofill({ date: "2026-10-07", now, providers, bookings: [], items: [item({ id: "priya", code: "D1110", durationMin: 45, priority: "P4", earliest: 900 })] });
    expect(open.placed[0]).toMatchObject({ providerId: "HY", startMin: 900 });
  });

  it("never double-books a provider", () => {
    const items = Array.from({ length: 30 }, (_, i) => item({ id: `c${i}`, code: "D0120", durationMin: 30, priority: "P4" }));
    const r = autofill({ date: "2026-10-06", now, providers, bookings: [], items });
    for (const a of r.placed) for (const b of r.placed) if (a !== b && a.providerId === b.providerId) expect(a.endMin <= b.startMin || b.endMin <= a.startMin).toBe(true);
    for (const a of r.placed) expect(a.startMin >= 720 && a.startMin < 780).toBe(false);
  });
});

describe("CSV import", () => {
  it("parses the import columns, quoted fields and times", () => {
    const { rows, errors } = parseScheduleCsv(
      'patient_id,name,procedure_code,duration_min,priority,earliest,latest\nP-2001,"Doe, J.",D1110,45,p4,3 pm,\nP-2002,K.,D2391,40,P3,,\n',
    );
    expect(errors).toEqual(["Row 3: duration_min must be a positive multiple of 15"]);
    expect(rows).toEqual([{ patient_id: "P-2001", name: "Doe, J.", procedure_code: "D1110", duration_min: 45, priority: "P4", earliest: 900, latest: null }]);
    expect(parseScheduleCsv("a,b\n1,2").errors[0]).toMatch(/Missing columns/);
  });

  it("auto-fills from the shown day through Friday", () => {
    expect(weekDays("2026-10-06")).toEqual(["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
  });
});

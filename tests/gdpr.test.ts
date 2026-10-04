import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { erasePatient, exportPatient } from "@/lib/gdpr";
import { hash } from "@/lib/audit";

describe("GDPR export and erasure", () => {
  it("exports the record, then erases it and everything linked, leaving only a hashed audit entry", async () => {
    await prisma.patient.create({
      data: {
        id: "G-1",
        name: "Erase Me",
        initials: "EM",
        allergies: [],
        flags: [],
        consents: { create: [{ purpose: "treatment", granted: true }] },
        studies: { create: [{ type: "pano", takenAt: new Date() }] },
      },
    });
    const ex = await exportPatient("G-1");
    expect(ex?.patient.name).toBe("Erase Me");
    expect(ex?.patient.consents).toHaveLength(1);

    expect(await erasePatient("G-1")).toBe(true);
    expect(await prisma.patient.findUnique({ where: { id: "G-1" } })).toBeNull();
    expect(await prisma.consent.count({ where: { patientId: "G-1" } })).toBe(0);
    expect(await prisma.imagingStudy.count({ where: { patientId: "G-1" } })).toBe(0);
    const ev = await prisma.auditEvent.findFirst({ where: { action: "gdpr.erase" } });
    expect(ev?.entityId).toBe(hash("G-1"));
    expect(JSON.stringify(ev)).not.toContain("Erase Me");
    expect(await erasePatient("G-1")).toBe(false);
  });
});

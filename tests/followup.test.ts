import { beforeAll, describe, expect, it } from "vitest";
import { computeReminderTime, computeSendTime, renderEmailHtml, templateEmail } from "@/lib/followup";
import { prisma } from "@/lib/db";
import { processFollowUps } from "@/lib/followup-actions";

describe("follow-up email", () => {
  it("writes the veneers template from visit notes", () => {
    const c = templateEmail({ firstName: "Elena", procedure: "Porcelain veneers", visitNotes: "", teeth: "#5–#12", count: 8 });
    expect(c.subject).toBe("Your new veneers: what to expect this week");
    expect(c.intro).toBe("Hi Elena, thank you for coming in yesterday. Your eight porcelain veneers (#5–#12) are bonded, and I recorded a short video on caring for them.");
    expect(c.tips).toHaveLength(3);
  });

  it("sends the morning after the visit and reminds on day 12", () => {
    expect(computeSendTime("2026-10-06").toISOString()).toBe("2026-10-07T09:00:00.000Z");
    expect(computeReminderTime("2026-10-06").toISOString()).toBe("2026-10-18T09:00:00.000Z");
  });

  it("renders email-safe HTML with escaped content and no scripts", () => {
    const c = { ...templateEmail({ firstName: "<b>x</b>", procedure: "Root canal", visitNotes: "" }) };
    const html = renderEmailHtml(c, { visitDate: "2026-10-06", videoLength: "0:47", videoUrl: "/v", bookUrl: "/b", prefsUrl: "/p" });
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('role="presentation"');
    expect(html).toContain("visit on Oct 6");
  });
});

describe("follow-up scheduler", () => {
  beforeAll(async () => {
    await prisma.patient.createMany({
      data: [
        { id: "T-1", name: "A.", initials: "A", allergies: [], flags: [], email: "a@test" },
        { id: "T-2", name: "B.", initials: "B", allergies: [], flags: [], email: "b@test" },
      ],
    });
    await prisma.consent.create({ data: { patientId: "T-1", purpose: "marketing_email", granted: true } });
    const base = { procedure: "Root canal", visitDate: "2026-10-06", subject: "s", content: {}, html: "<p>x</p>", status: "approved" };
    await prisma.followUp.createMany({
      data: [
        { ...base, id: "F-1", patientId: "T-1", scheduledFor: new Date("2026-10-07T09:00:00Z"), reminderAt: new Date("2026-10-18T09:00:00Z") },
        { ...base, id: "F-2", patientId: "T-2", scheduledFor: new Date("2026-10-07T09:00:00Z") },
      ],
    });
  });

  it("only sends with email consent, then sends the day-12 reminder if not booked", async () => {
    expect(await processFollowUps(new Date("2026-10-07T08:00:00Z"))).toEqual({ sent: 0, reminded: 0, skipped: 0 });
    expect(await processFollowUps(new Date("2026-10-07T09:01:00Z"))).toEqual({ sent: 1, reminded: 0, skipped: 1 });
    expect((await prisma.followUp.findUnique({ where: { id: "F-2" } }))!.status).toBe("skipped_no_consent");
    expect(await processFollowUps(new Date("2026-10-18T09:05:00Z"))).toEqual({ sent: 0, reminded: 1, skipped: 0 });
  });
});

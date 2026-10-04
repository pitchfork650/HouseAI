import { z } from "zod";
import { callJSON } from "./llm";
import { loadPrompt } from "./prompts";
import { PRACTICE } from "./config";
import { dateFromISODate, shortDate } from "./clock";
import { ICON } from "@/components/icons";

export const EmailContentSchema = z.object({
  subject: z.string().min(3),
  intro: z.string().min(10),
  videoTitle: z.string(),
  tipsHeading: z.string(),
  tips: z.array(z.string()).min(1).max(5),
  cta: z.string(),
});
export type EmailContent = z.infer<typeof EmailContentSchema>;

export type VisitContext = {
  firstName: string;
  procedure: string; // matches Video.procedure
  visitNotes: string; // minimal chart context: procedure, teeth, notes. No DOB, no contact details.
  teeth?: string;
  count?: number;
};

const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Template fallback per procedure (used in mock mode and when the model call fails). */
export function templateEmail(v: VisitContext): EmailContent {
  const count = v.count && v.count <= 10 ? NUM[v.count] : String(v.count ?? "");
  switch (v.procedure) {
    case "Porcelain veneers":
      return {
        subject: "Your new veneers: what to expect this week",
        intro: `Hi ${v.firstName}, thank you for coming in yesterday. Your ${count ? count + " " : ""}porcelain veneers${v.teeth ? ` (${v.teeth})` : ""} are bonded, and I recorded a short video on caring for them.`,
        videoTitle: "Caring for new veneers: the first 14 days",
        tipsHeading: "For the next few days",
        tips: [
          "Mild sensitivity to cold is normal and usually fades within a week.",
          "Avoid biting hard foods (ice, nuts, pens) with your front teeth.",
          "Floss normally. The edges are sealed.",
        ],
        cta: "Book your 2-week check",
      };
    case "Wisdom tooth extraction":
      return {
        subject: "After your wisdom tooth removal: the first few days",
        intro: `Hi ${v.firstName}, thank you for coming in yesterday. Your wisdom tooth removal${v.teeth ? ` (${v.teeth})` : ""} went as planned, and I recorded a short video on healing well.`,
        videoTitle: "Healing after wisdom tooth removal",
        tipsHeading: "For the next few days",
        tips: ["Some swelling is normal for two to three days.", "Avoid straws and smoking so the clot can settle.", "Rinse gently with warm salt water after meals from tomorrow."],
        cta: "Book your post-op check",
      };
    case "Root canal":
      return {
        subject: "After your root canal: what to expect",
        intro: `Hi ${v.firstName}, thank you for coming in yesterday. Your root canal${v.teeth ? ` on ${v.teeth}` : ""} is done, and I recorded a short video on the next steps.`,
        videoTitle: "After a root canal: the next steps",
        tipsHeading: "For the next few days",
        tips: ["The tooth may feel tender when biting for a few days.", "Chew on the other side until the final crown is placed.", "Brush and floss normally."],
        cta: "Book your crown appointment",
      };
    default:
      return {
        subject: `After your visit: ${v.procedure.toLowerCase()}`,
        intro: `Hi ${v.firstName}, thank you for coming in yesterday. I recorded a short video about your ${v.procedure.toLowerCase()}.`,
        videoTitle: v.procedure,
        tipsHeading: "For the next few days",
        tips: ["Brush and floss as usual.", "Call us if anything feels unusual."],
        cta: "Book your next check",
      };
  }
}

export async function generateEmail(v: VisitContext, forceMock = false) {
  const prompt = loadPrompt("follow-up-email");
  try {
    return await callJSON({
      agent: "Follow-up Writer",
      promptVersion: prompt.version,
      system: prompt.text,
      prompt: JSON.stringify(v),
      schema: EmailContentSchema,
      mock: () => templateEmail(v),
      forceMock,
    });
  } catch (e) {
    console.warn("[follow-up] model call failed, using template", e);
    return { data: templateEmail(v), model: "template", mocked: true };
  }
}

/** Follow-up sends the day after the visit at 09:00 (procedure completed + 24 h, in the morning send window). */
export function computeSendTime(visitDate: string, hour = 9): Date {
  return dateFromISODate(visitDate, (24 + hour) * 60);
}

/** Day-12 reminder if the patient hasn't booked. */
export function computeReminderTime(visitDate: string, hour = 9): Date {
  return dateFromISODate(visitDate, (12 * 24 + hour) * 60);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Email-client-safe HTML: table layout, inline styles, no scripts, no web fonts
 * required. Mirrors the in-app preview.
 */
export function renderEmailHtml(c: EmailContent, o: { visitDate: string; videoLength: string; videoUrl: string; bookUrl: string; prefsUrl: string }): string {
  const font = "font-family:'Public Sans',Helvetica,Arial,sans-serif;";
  const tip = (t: string) =>
    `<tr><td valign="top" style="padding:0 10px 10px 0;width:18px;color:#0B7285;font-weight:700;${font}">&#10003;</td><td style="padding:0 0 10px 0;font-size:15px;line-height:1.5;color:#0F1B2D;${font}">${esc(t)}</td></tr>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#EEF3F8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F8;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#FFFFFF;border:1px solid #D9E2EC;border-radius:16px;overflow:hidden;">
<tr><td style="background:#0B1F3A;padding:18px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="44" valign="middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="32" height="32" align="center" valign="middle" style="background:#0B7285;border-radius:9px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"><path d="${ICON.tooth}"/></svg></td></tr></table></td>
    <td valign="middle" style="color:#FFFFFF;font-weight:700;${font}">${esc(PRACTICE.practiceName)}</td>
    <td align="right" valign="middle" style="color:#7DD3E0;font-size:12px;${font}">Aftercare · Day 1</td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 32px;">
  <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#0F1B2D;${font}">${esc(c.intro)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="background:#13335E;border-radius:14px;padding:16px;">
    <div style="font-family:'IBM Plex Mono',Menlo,monospace;font-size:12px;color:#7DD3E0;">[ VIDEO · ${esc(PRACTICE.doctorShort)} · ${esc(o.videoLength)} ]</div>
    <div style="text-align:center;padding:48px 0;"><a href="${esc(o.videoUrl)}" style="display:inline-block;width:76px;height:76px;line-height:76px;border-radius:38px;background:#FFFFFF;color:#0B7285;font-size:28px;text-decoration:none;">&#9658;</a></div>
    <div style="font-size:15px;font-weight:600;color:#FFFFFF;${font}">${esc(c.videoTitle)}</div>
  </td></tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#F6F9FC;border:1px solid #E6ECF2;border-radius:12px;"><tr><td style="padding:16px 18px;">
    <div style="font-weight:700;font-size:15px;margin-bottom:10px;color:#0F1B2D;${font}">${esc(c.tipsHeading)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0">${c.tips.map(tip).join("")}</table>
  </td></tr></table>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="background:#0B7285;border-radius:10px;"><a href="${esc(o.bookUrl)}" style="display:inline-block;padding:13px 22px;color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;${font}">${esc(c.cta)}</a></td></tr></table>
  <p style="margin:0;font-size:13px;line-height:1.5;color:#52627A;${font}">Questions? Reply to this email or call ${esc(PRACTICE.phone)}. You're receiving this because of your visit on ${esc(shortDate(o.visitDate))}. <a href="${esc(o.prefsUrl)}" style="color:#0B7285;">Email preferences</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function formatLength(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

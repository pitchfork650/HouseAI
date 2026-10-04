import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PRACTICE } from "@/lib/config";
import { sendLabel, shortDate } from "@/lib/clock";
import { formatLength, type EmailContent } from "@/lib/followup";
import { Icon, LogoTile, PlayIcon, type IconName } from "@/components/icons";
import { Card } from "@/components/ui";
import { FollowUpActions } from "@/components/followup/FollowUpActions";

export default async function FollowUpPage({ params }: { params: Promise<{ followUpId: string }> }) {
  const { followUpId } = await params;
  const fu = await prisma.followUp.findUnique({ where: { id: followUpId }, include: { patient: true, video: true } });
  if (!fu) notFound();
  const c = fu.content as EmailContent;
  const [videos, consent] = await Promise.all([
    prisma.video.findMany({ orderBy: { order: "asc" } }),
    prisma.consent.findFirst({ where: { patientId: fu.patientId, purpose: "marketing_email" }, orderBy: { timestamp: "desc" } }),
  ]);
  const statusWord = fu.status === "sent" ? "SENT" : fu.status === "skipped_no_consent" ? "NOT SENT (NO CONSENT)" : "SENDS";
  const rules: { k: string; v: string; icon: IconName }[] = [
    { k: "Trigger", v: "Procedure completed + 24 h", icon: "clock" },
    { k: "Personalized by", v: "Gemini, from chart + visit notes", icon: "sparkle" },
    { k: "Reminder", v: "Day 12 if not booked", icon: "bell" },
    { k: "Consent", v: consent?.granted ? `Opted in · GDPR record #${consent.recordRef ?? "[ID]"}` : "Not opted in · won't send", icon: "shieldCheck" },
  ];

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-col gap-3" style={{ flex: "999 1 560px" }}>
        <div className="flex flex-wrap items-center justify-between gap-[10px]">
          <div className="font-mono text-[12px] tracking-[0.1em] text-muted">
            PREVIEW · {statusWord} {sendLabel(fu.scheduledFor)} · {fu.patientId}
          </div>
          <FollowUpActions id={fu.id} status={fu.status} />
        </div>

        <div className="overflow-hidden rounded-[16px] border border-border bg-white" style={{ boxShadow: "0 1px 2px rgba(11,31,58,0.05), 0 12px 32px rgba(11,31,58,0.06)" }}>
          <div className="flex flex-col gap-1 border-b border-border-soft bg-subtle px-6 py-[14px] text-[13px] text-muted">
            <div>
              From: {PRACTICE.doctorName} &lt;{PRACTICE.fromAddress}&gt;
            </div>
            <div>To: {fu.patient.name}</div>
            <div className="mt-[6px] text-[17px] font-bold text-ink">{c.subject}</div>
          </div>
          <div className="flex items-center gap-3 bg-navy px-8 py-[18px]">
            <LogoTile size={32} radius={9} glyph={18} strokeWidth={1.8} />
            <span className="font-bold text-white">{PRACTICE.practiceName}</span>
            <span className="ml-auto text-[12px] text-cyan">Aftercare · Day 1</span>
          </div>
          <div className="flex max-w-[640px] flex-col gap-[18px] px-8 py-7 max-[520px]:px-5">
            <p className="m-0 text-[16px] leading-[1.6]">{c.intro}</p>
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[14px] bg-navy-2">
              <svg width="100%" height="100%" viewBox="0 0 640 360" preserveAspectRatio="none" className="absolute inset-0 opacity-25" aria-hidden="true">
                <path d="M0 250 H220 L236 250 L250 200 L266 300 L282 170 L298 270 L310 250 H640" stroke="#38BDCF" strokeWidth="3" fill="none" />
              </svg>
              <div className="absolute left-4 top-[14px] font-mono text-[12px] text-cyan">
                [ VIDEO · {PRACTICE.doctorShort} · {fu.video ? formatLength(fu.video.lengthSec) : "0:00"} ]
              </div>
              <a
                href={fu.video?.url ?? "#"}
                aria-label="Play video"
                className="relative flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white"
                style={{ boxShadow: "0 0 0 10px rgba(255,255,255,0.15)" }}
              >
                <PlayIcon size={28} color="#0B7285" />
              </a>
              <div className="absolute bottom-[14px] left-4 text-[15px] font-semibold text-white">{c.videoTitle}</div>
            </div>
            <div className="flex flex-col gap-[10px] rounded-[12px] border border-border-soft bg-subtle px-[18px] py-4 text-[15px] leading-[1.5]">
              <div className="font-bold">{c.tipsHeading}</div>
              {c.tips.map((t) => (
                <div key={t} className="flex gap-[10px]">
                  <Icon name="check" size={18} color="#0B7285" strokeWidth={2.4} style={{ flex: "none", marginTop: 3 }} />
                  {t}
                </div>
              ))}
            </div>
            <Link
              href={`/schedule?book=${fu.patientId}`}
              className="inline-flex min-h-[46px] items-center gap-[10px] self-start rounded-[10px] bg-teal px-[22px] text-[15px] font-bold text-white no-underline hover:bg-teal-dark hover:text-white"
            >
              <Icon name="calendar" size={18} color="#FFFFFF" strokeWidth={2} />
              {c.cta}
            </Link>
            <p className="m-0 text-[13px] leading-[1.5] text-muted">
              Questions? Reply to this email or call {PRACTICE.phone}. You&apos;re receiving this because of your visit on {shortDate(fu.visitDate)}.{" "}
              <a href={`/preferences/${fu.patientId}`}>Email preferences</a>
            </p>
          </div>
        </div>
      </section>

      <aside className="flex min-w-0 flex-col gap-4" style={{ flex: "1 1 320px" }}>
        <Card className="flex flex-col gap-3 px-5 py-[18px] text-[14px]">
          <h2 className="m-0 text-[16px] font-bold">Automation</h2>
          {rules.map((r) => (
            <div key={r.k} className="flex items-center gap-3">
              <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-teal-tint">
                <Icon name={r.icon} size={17} color="#0B7285" strokeWidth={1.9} />
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] text-muted">{r.k}</span>
                <span className="font-semibold">{r.v}</span>
              </div>
            </div>
          ))}
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-border-soft px-5 py-4">
            <h2 className="m-0 text-[16px] font-bold">Video library by procedure</h2>
          </div>
          {videos.map((v) => (
            <div key={v.id} className="flex items-center gap-3 border-b border-row-line px-5 py-[10px] text-[14px]">
              <div className="flex h-8 w-[52px] flex-none items-center justify-center rounded-[6px] bg-navy-2">
                <PlayIcon />
              </div>
              <span className="flex-1">{v.procedure}</span>
              <span className="font-mono text-[12px] text-muted">{formatLength(v.lengthSec)}</span>
            </div>
          ))}
        </Card>
      </aside>
    </div>
  );
}

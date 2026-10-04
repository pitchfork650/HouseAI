import Link from "next/link";
import { prisma } from "@/lib/db";
import { DEFAULT_ROUTES } from "@/lib/config";
import { dayEyebrow } from "@/lib/clock";
import { navItems } from "@/lib/nav";
import { DEFAULT_DAY } from "@/lib/schedule";
import type { OverlayShape } from "@/lib/pano";
import { FLOW_ROWS, COMPLIANCE_ITEMS } from "@/content/flow";
import { Icon, LogoTile, type IconName } from "@/components/icons";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroDemo, type DemoFinding } from "@/components/landing/HeroDemo";
import { Workflow, type WorkflowStep } from "@/components/landing/Workflow";
import { Reveal, ScrollTilt, Words } from "@/components/landing/Motion";
import { CalendarVisual, FollowupVisual, InsuranceVisual, IntakeVisual, SwarmVisual } from "@/components/landing/Visuals";

export const dynamic = "force-dynamic";

const PRIORITY_ORDER = ["P1", "P2", "P3", "P4"];

function Feature({ eyebrow, title, body, children, className = "", delay = 0 }: { eyebrow: string; title: string; body: string; children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={`lp-card flex flex-col overflow-hidden ${className}`}>
      <div className="flex flex-col gap-2 p-7 pb-0 max-[640px]:p-5 max-[640px]:pb-0">
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-lp-accent">{eyebrow}</span>
        <h3 className="m-0 text-[20px] font-semibold tracking-[-0.02em] text-lp-ink">{title}</h3>
        <p className="m-0 max-w-[460px] text-[14px] leading-[1.6] text-lp-muted">{body}</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-7 max-[640px]:p-5">{children}</div>
    </Reveal>
  );
}

export default async function LandingPage() {
  const [items, run] = await Promise.all([
    navItems(),
    prisma.swarmRun.findFirst({
      where: { kind: "diagnostic" },
      orderBy: { startedAt: "desc" },
      include: { agents: { orderBy: { order: "asc" } }, findings: { orderBy: { order: "asc" } } },
    }),
  ]);
  const agents = (run?.agents ?? []).map((a) => ({ name: a.name, badge: a.badge, status: a.status }));
  const findings: DemoFinding[] = (run?.findings ?? [])
    .map((f) => ({
      teeth: f.teeth as number[],
      priority: f.priority,
      title: f.text.split(",")[0],
      suggested: f.suggested,
      agreement: f.agreement,
      overlay: f.overlay as OverlayShape[],
    }))
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
  const swarmNames = agents.filter((a) => a.status !== "skip" && a.name !== "Skeptic" && a.name !== "Verifier").slice(0, 5).map((a) => a.name);

  const steps: WorkflowStep[] = FLOW_ROWS.flatMap((row) =>
    row.steps.map((s) => ({ num: s.num.split(" ")[0], title: s.title, icon: s.icon, tag: s.tag, body: s.body, swarm: s.swarm, href: s.href })),
  );
  const loop = FLOW_ROWS.find((r) => r.loopsBack)?.loopsBack;

  const security: { icon: IconName; title: string; body: string }[] = [
    { icon: "check", title: "The dentist signs off", body: "Agents suggest. Every clinical finding waits for your dentist before it touches the chart." },
    { icon: "document", title: "Every decision on record", body: "Each agent output and each human approval is written to an audit log you can export." },
    { icon: "swarm", title: "Minimum data to models", body: "Agents see images and the context they need. Never names, never contact details." },
    { icon: "shieldCheck", title: "SOC 2 and GDPR", body: "SOC 2 compliant, with consent per purpose, EU data residency, data export and erasure built in." },
  ];

  return (
    <div className="lp min-h-screen">
      <LandingNav demoHref={DEFAULT_ROUTES.diagnostics} />

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="lp-hero-wash pointer-events-none absolute inset-x-0 top-0 h-[900px]" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-6 pt-20 text-center max-[640px]:px-4 max-[640px]:pt-12">
          <a href="#workflow" className="lp-fade mb-8 inline-flex items-center gap-2 rounded-full border border-lp-line bg-lp-surface/80 py-1 pl-1 pr-3 text-[13px] text-lp-muted no-underline backdrop-blur transition-colors hover:border-lp-line-strong hover:text-lp-ink">
            <span className="rounded-full bg-lp-accent-tint px-2 py-[2px] text-[12px] font-medium text-lp-accent">New</span>
            Recall X-rays now compared against earlier visits
            <span aria-hidden="true">→</span>
          </a>
          <h1 className="m-0 max-w-[920px] text-[76px] font-semibold leading-[1.02] tracking-[-0.045em] text-lp-ink max-[900px]:text-[56px] max-[640px]:text-[40px]">
            <Words text="From X-ray to follow-up," />
            <br className="max-[640px]:hidden" />
            <Words text="on one record." start={300} className="text-lp-faint" />
          </h1>
          <p className="lp-fade m-0 mt-7 max-w-[600px] text-[19px] leading-[1.55] text-lp-muted max-[640px]:text-[16px]" style={{ animationDelay: "550ms" }}>
            HouseAI runs the work between the chair and the front desk. Agent swarms read every X-ray, fill the calendar, chase insurance and bring patients back, while your dentists sign off on every finding.
          </p>
          <div className="lp-fade mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "700ms" }}>
            <Link href={DEFAULT_ROUTES.diagnostics} className="lp-btn lp-btn-dark h-11 px-5 text-[15px]">
              Open the live demo
              <span className="lp-btn-arrow" aria-hidden="true">→</span>
            </Link>
            <a href="#workflow" className="lp-btn lp-btn-ghost h-11 px-5 text-[15px]">
              See how it works
            </a>
          </div>
        </div>

        <div className="lp-rise relative mx-auto mt-16 max-w-[1200px] px-6 max-[640px]:mt-10 max-[640px]:px-3" style={{ animationDelay: "850ms" }}>
          <ScrollTilt>
            {run ? <HeroDemo patientId={run.patientId} dayLabel={dayEyebrow(DEFAULT_DAY)} agents={agents} findings={findings} /> : null}
          </ScrollTilt>
          <p className="m-0 mt-4 text-center text-[12px] text-lp-faint">Synthetic demo patient. Decision support only.</p>
        </div>
      </header>

      {/* Product */}
      <section id="product" className="mx-auto max-w-[1200px] scroll-mt-20 px-6 py-24 max-[640px]:px-4 max-[640px]:py-16">
        <Reveal className="mb-14 flex max-w-[720px] flex-col gap-4">
          <span className="text-[13px] font-medium text-lp-accent">Product</span>
          <h2 className="m-0 text-[48px] font-semibold leading-[1.05] tracking-[-0.04em] text-lp-ink max-[640px]:text-[34px]">
            Everything between the chair and the front desk.
          </h2>
          <p className="m-0 text-[17px] leading-[1.6] text-lp-muted">
            Five modules share one patient record. Swarms handle the work that needs judgement and a second opinion; simple rules handle the rest.
          </p>
        </Reveal>

        <div className="grid grid-cols-6 gap-4 max-[900px]:grid-cols-1">
          <Feature className="col-span-4 max-[900px]:col-span-1" eyebrow="Diagnostics swarm" title="Every X-ray gets a panel, not a single opinion" body="Specialist agents each read the image. A skeptic challenges what they find, and a consensus agent explains each finding by tooth number.">
            <div className="w-full overflow-x-auto [scrollbar-width:none]">
              <SwarmVisual agents={swarmNames} />
            </div>
          </Feature>
          <Feature className="col-span-2 max-[900px]:col-span-1" delay={80} eyebrow="Intake" title="Cards and records, read for you" body="OCR fills in the fields. Staff only confirm what's marked low-confidence.">
            <IntakeVisual />
          </Feature>
          <Feature className="col-span-2 max-[900px]:col-span-1" eyebrow="Calendar builder" title="A full day, already booked" body="Long cases in the morning, one emergency slot held, checkups fill the gaps.">
            <CalendarVisual />
          </Feature>
          <Feature className="col-span-2 max-[900px]:col-span-1" delay={80} eyebrow="Insurance swarm" title="One agent per question" body="Eligibility, copays, dual coverage and pre-approvals, retried until they clear.">
            <InsuranceVisual />
          </Feature>
          <Feature className="col-span-2 max-[900px]:col-span-1" delay={160} eyebrow="Follow-up" title="Patients come back" body="A personal email and a short video for their procedure, 24 hours after the visit.">
            <FollowupVisual />
          </Feature>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="scroll-mt-16 border-t border-lp-line bg-lp-surface">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-16 px-6 py-24 max-[900px]:grid-cols-1 max-[900px]:gap-8 max-[640px]:px-4 max-[640px]:py-16">
          <div>
            <Reveal className="sticky top-28 flex flex-col gap-4">
              <span className="text-[13px] font-medium text-lp-accent">How it works</span>
              <h2 className="m-0 text-[44px] font-semibold leading-[1.06] tracking-[-0.04em] text-lp-ink max-[640px]:text-[32px]">How a patient moves through your practice.</h2>
              <p className="m-0 text-[16px] leading-[1.6] text-lp-muted">Seven steps, one record. Each step hands the next exactly what it needs, and each opens in the live demo.</p>
              <div className="mt-2 flex flex-col gap-2 text-[13px] text-lp-muted">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-lp-accent" /> Agent swarm
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-lp-ink" /> Single model call or rules
                </span>
              </div>
              {loop ? (
                <Link href={loop.href} className="group mt-6 flex items-start gap-3 rounded-xl border border-dashed border-lp-line-strong p-4 no-underline transition-colors hover:border-lp-accent max-[900px]:hidden">
                  <Icon name="loop" size={18} color="#0B7285" className="mt-[2px] flex-none transition-transform duration-700 group-hover:-rotate-180" />
                  <span className="flex flex-col gap-1">
                    <span className="text-[14px] font-medium text-lp-ink">{loop.title}</span>
                    <span className="text-[13px] leading-[1.55] text-lp-muted">{loop.body}</span>
                  </span>
                </Link>
              ) : null}
            </Reveal>
          </div>
          <Workflow steps={steps} />
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="lp-cta-wash pointer-events-none absolute inset-0" aria-hidden="true" />
        <Reveal className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-6 py-32 text-center max-[640px]:px-4 max-[640px]:py-20">
          <h2 className="m-0 max-w-[760px] text-[56px] font-semibold leading-[1.04] tracking-[-0.045em] text-lp-ink max-[640px]:text-[36px]">Your next clinic day, already handled.</h2>
          <p className="m-0 max-w-[520px] text-[17px] leading-[1.6] text-lp-muted">Walk through a full clinic day in the demo: the swarm&apos;s read, the booked schedule, insurance in flight and follow-ups ready to send.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href={DEFAULT_ROUTES.diagnostics} className="lp-btn lp-btn-dark h-11 px-5 text-[15px]">
              Open the live demo
              <span className="lp-btn-arrow" aria-hidden="true">→</span>
            </Link>
            <Link href="/schedule" className="lp-btn lp-btn-ghost h-11 px-5 text-[15px]">
              View the schedule
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Security and footer share one dark band */}
      <div className="lp-dark relative overflow-hidden">
        <div className="lp-dark-wash pointer-events-none absolute inset-0" aria-hidden="true" />

        <section id="security" className="relative scroll-mt-16">
          <div className="mx-auto max-w-[1200px] px-6 py-28 max-[640px]:px-4 max-[640px]:py-16">
            <Reveal className="flex max-w-[760px] flex-col gap-4">
              <span className="text-[13px] font-medium text-[#7DD3E0]">Security and oversight</span>
              <h2 className="m-0 text-[48px] font-semibold leading-[1.05] tracking-[-0.04em] text-white max-[640px]:text-[34px]">
                Built for clinical accountability, <span className="text-white/45">not around it.</span>
              </h2>
            </Reveal>
            <div className="mt-16 grid grid-cols-4 gap-10 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
              {security.map((s, i) => (
                <Reveal key={s.title} delay={i * 90} className="flex flex-col gap-3 border-t border-white/10 pt-6">
                  <Icon name={s.icon} size={20} color="#7DD3E0" />
                  <h3 className="m-0 text-[16px] font-semibold text-white">{s.title}</h3>
                  <p className="m-0 text-[14px] leading-[1.6] text-white/55">{s.body}</p>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-16 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-8 text-[13px] text-white/45">
              {COMPLIANCE_ITEMS.map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <Icon name="check" size={14} color="#38BDCF" />
                  {t}
                </span>
              ))}
            </Reveal>
          </div>
        </section>

        <footer className="relative border-t border-white/10">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-start justify-between gap-10 px-6 py-12 max-[640px]:px-4">
            <div className="flex max-w-[300px] flex-col gap-3">
              <span className="flex items-center gap-[10px]">
                <LogoTile size={24} radius={7} glyph={14} />
                <span className="text-[14px] font-semibold text-white">HouseAI</span>
              </span>
              <span className="text-[13px] leading-[1.6] text-white/45">Clinical AI for dental practices. Decision support only; the dentist confirms every finding.</span>
            </div>
            <dl className="m-0 grid grid-cols-[88px_auto] gap-x-8 gap-y-6 text-[13px]">
              <dt className="font-medium text-white">Product</dt>
              <dd className="m-0 grid grid-cols-2 gap-x-10 gap-y-3">
                {items.filter((i) => i.key !== "flow").map((i) => (
                  <Link key={i.key} href={i.href} className="text-white/55 no-underline transition-colors hover:text-white">
                    {i.label}
                  </Link>
                ))}
              </dd>
              <dt className="font-medium text-white">Company</dt>
              <dd className="m-0 grid grid-cols-2 gap-x-10 gap-y-3">
                <a href="#security" className="text-white/55 no-underline transition-colors hover:text-white">Security</a>
                <a href="#workflow" className="text-white/55 no-underline transition-colors hover:text-white">How it works</a>
              </dd>
            </dl>
          </div>
        </footer>
      </div>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { DEFAULT_ROUTES } from "@/lib/config";
import { dayEyebrow } from "@/lib/clock";
import { navItems } from "@/lib/nav";
import { DEFAULT_DAY } from "@/lib/schedule";
import { swarmHost } from "@/lib/swarm/host";
import { FLOW_ROWS, COMPLIANCE_ITEMS, type FlowStep } from "@/content/flow";
import { Icon, LogoTile, type IconName } from "@/components/icons";
import { TopNav } from "@/components/TopNav";
import { CountUp, Reveal } from "@/components/landing/Motion";
import { btnPrimary } from "@/components/ui";

export const dynamic = "force-dynamic";

function Arrow({ dashed = false }: { dashed?: boolean }) {
  return (
    <div className="flex w-[44px] flex-none items-center justify-center max-[800px]:hidden" aria-hidden="true">
      <svg width="34" height="14" viewBox="0 0 34 14" fill="none" stroke="#8FA3BD" strokeWidth="1.8" className={dashed ? "" : "flow-arrow"} strokeDasharray={dashed ? "3 3" : undefined}>
        {dashed ? <path d="M1 7h30" /> : <><path d="M1 7h24" /><path d="M25 2l6 5-6 5" style={{ strokeDasharray: "none", animation: "none" }} /></>}
      </svg>
    </div>
  );
}

function StepCard({ s }: { s: FlowStep }) {
  const sw = !!s.swarm;
  return (
    <Link
      href={s.href}
      className={`lift group box-border flex h-full w-[316px] min-w-[200px] max-w-full flex-shrink flex-col gap-3 rounded-[16px] p-[22px] no-underline max-[800px]:w-full max-[800px]:min-w-0 ${
        sw ? "bg-navy text-white hover:text-white" : "border border-border bg-white text-ink hover:border-[#B9C8D8] hover:text-ink"
      }`}
      style={{ boxShadow: sw ? "0 10px 30px rgba(11,31,58,0.25)" : "0 1px 2px rgba(11,31,58,0.05), 0 8px 24px rgba(11,31,58,0.05)" }}
    >
      <div className="flex items-center justify-between">
        <div className={`flex h-[44px] w-[44px] items-center justify-center rounded-[12px] transition-transform duration-300 group-hover:scale-110 ${sw ? "bg-teal" : "bg-p3-tint"}`}>
          <Icon name={s.icon} size={22} color={sw ? "#FFFFFF" : "#1A56DB"} />
        </div>
        <span className={`inline-flex items-center gap-[6px] rounded-full px-[10px] py-1 text-[12px] font-semibold ${sw ? "bg-teal text-white" : "bg-chip text-ink-2"}`}>
          {sw ? <span className="live-dot h-[6px] w-[6px] rounded-full bg-cyan-pale" /> : null}
          {s.tag}
        </span>
      </div>
      <div className="flex items-baseline gap-[10px]">
        <span className="whitespace-nowrap font-mono text-[13px]" style={{ color: sw ? "#7DD3E0" : "#52627A" }}>
          {s.num}
        </span>
        <h3 className="m-0 text-[21px] font-bold">{s.title}</h3>
      </div>
      <p className="m-0 text-[14px] leading-[1.55]" style={{ color: sw ? "#C9D6E8" : "#3A4A60" }}>
        {s.body}
      </p>
      <div
        className="mt-auto flex items-center justify-between border-t pt-3 text-[13px] font-semibold"
        style={{ borderColor: sw ? "#1E3E66" : "#E6ECF2", color: sw ? "#7DD3E0" : "#52627A" }}
      >
        {s.out}
        <span className="translate-x-0 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" aria-hidden="true">
          →
        </span>
      </div>
    </Link>
  );
}

const AGENT_DOT: Record<string, string> = { done: "#38BDCF", flag: "#FB923C", skip: "#52627A", failed: "#FB923C", running: "#A5F3FC", queued: "#52627A" };

export default async function FlowPage() {
  const [items, host, apptsToday, followUps, run] = await Promise.all([
    navItems(),
    swarmHost().status(),
    prisma.appointment.count({ where: { date: DEFAULT_DAY, isHold: false } }),
    prisma.followUp.count({ where: { status: { in: ["draft", "approved"] } } }),
    prisma.swarmRun.findFirst({ where: { kind: "diagnostic" }, orderBy: { startedAt: "desc" }, include: { agents: { orderBy: { order: "asc" } }, patient: true } }),
  ]);
  const findings = items.find((i) => i.key === "diagnostics")?.count ?? 0;
  const lanes = items.find((i) => i.key === "insurance")?.count ?? 0;
  const kpis: { label: string; value: number; icon: IconName; href: string; tone: string }[] = [
    { label: "Appointments booked", value: apptsToday, icon: "calendar", href: "/schedule", tone: "#7DD3E0" },
    { label: "Findings awaiting sign-off", value: findings, icon: "scan", href: DEFAULT_ROUTES.diagnostics, tone: "#A5F3FC" },
    { label: "Insurance lanes retrying", value: lanes, icon: "shieldCheck", href: DEFAULT_ROUTES.insurance, tone: "#FDBA74" },
    { label: "Follow-ups queued", value: followUps, icon: "mail", href: DEFAULT_ROUTES.followUp, tone: "#7DD3E0" },
  ];
  const hostLabel = host.connected ? "OpenSwarm host connected" : host.kind === "mock" ? "OpenSwarm · mock mode" : `OpenSwarm · ${host.label.replace("Host ", "")}`;
  const trust: { icon: IconName; title: string; body: string }[] = [
    { icon: "shieldCheck", title: "GDPR by design", body: "Consent per purpose, EU data residency, export and erasure." },
    { icon: "document", title: "Audit log", body: "Every agent output and every human decision is recorded." },
    { icon: "swarm", title: "Minimal data to AI", body: "Agents see images and minimum context. Never names." },
    { icon: "check", title: "Dentist signs off", body: "Your dentist confirms every finding before it reaches the chart." },
  ];

  return (
    <div className="box-border flex min-h-screen flex-col bg-bg text-ink">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-navy/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-16 py-2 max-[800px]:px-4">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <LogoTile size={32} radius={9} glyph={18} />
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-extrabold text-white">HouseAI</span>
              <span className="text-[11px] text-cyan">Dental clinical suite</span>
            </span>
          </Link>
          <div className="min-w-0 flex-1 max-[1100px]:order-3 max-[1100px]:basis-full">
            <TopNav items={items} />
          </div>
          <span className="hidden items-center gap-2 rounded-full bg-navy-2 px-3 py-[6px] text-[12px] font-semibold text-white min-[900px]:inline-flex" title={host.detail}>
            <span className={`h-2 w-2 rounded-full ${host.connected ? "ping" : ""}`} style={{ background: host.connected ? "#34D399" : "#FBBF24" }} />
            {hostLabel}
          </span>
        </div>
      </div>

      {/* Hero */}
      <header className="relative overflow-hidden bg-navy text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="glow absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, #0B7285 0%, transparent 70%)" }} />
          <div className="glow-slow absolute -right-32 top-10 h-[460px] w-[460px] rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, #38BDCF 0%, transparent 70%)" }} />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "linear-gradient(#7DD3E0 1px, transparent 1px), linear-gradient(90deg, #7DD3E0 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "linear-gradient(to bottom, black, transparent 85%)" }}
          />
          <svg width="1600" height="120" viewBox="0 0 1600 120" fill="none" className="absolute bottom-0 left-0 opacity-50">
            <path className="heartbeat" d="M0 80 H520 L540 80 L556 40 L572 108 L588 20 L604 96 L616 80 H1040 L1056 80 L1068 56 L1080 96 L1092 80 H1600" stroke="#38BDCF" strokeWidth="2" />
          </svg>
        </div>

        <div className="relative mx-auto flex max-w-[1600px] flex-wrap items-center gap-12 px-16 pb-20 pt-16 max-[800px]:gap-8 max-[800px]:px-5 max-[800px]:pb-14 max-[800px]:pt-10">
          <div className="flex min-w-0 flex-col gap-6" style={{ flex: "999 1 560px" }}>
            <div className="rise flex items-center gap-4" style={{ animationDelay: "0ms" }}>
              <LogoTile size={64} radius={18} glyph={34} />
              <div className="flex flex-col gap-1">
                <div className="font-mono text-[13px] tracking-[0.1em] text-cyan">HOUSEAI DENTAL · CLINICAL FLOW</div>
                <div className="text-[13px] text-on-navy">For cosmetic, restorative and general dental practices</div>
              </div>
            </div>
            <h1 className="rise m-0 max-w-[820px] text-[56px] font-extrabold leading-[1.05] tracking-[-0.02em] max-[800px]:text-[36px]" style={{ animationDelay: "80ms" }}>
              From X-ray to follow-up, <span className="bg-gradient-to-r from-cyan to-cyan-2 bg-clip-text text-transparent">one record</span>
            </h1>
            <p className="rise m-0 max-w-[640px] text-[18px] leading-[1.6] text-on-navy max-[800px]:text-[16px]" style={{ animationDelay: "160ms" }}>
              AI swarms read every X-ray, build the calendar, chase insurance and bring patients back for their next visit. Your dentists stay in control: every clinical finding waits for their sign-off.
            </p>
            <div className="rise flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
              <Link href={DEFAULT_ROUTES.diagnostics} className={`${btnPrimary} px-5 text-[15px] shadow-[0_8px_24px_rgba(11,114,133,0.45)]`}>
                <Icon name="scan" size={18} color="#FFFFFF" />
                See the X-ray swarm
              </Link>
              <Link
                href="/schedule"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-white/25 bg-white/5 px-5 text-[15px] font-semibold text-white no-underline backdrop-blur hover:bg-white/10 hover:text-white"
              >
                <Icon name="calendar" size={18} />
                Explore the schedule
              </Link>
            </div>
            <div className="rise flex flex-wrap gap-[10px]" style={{ animationDelay: "320ms" }}>
              <span className="inline-flex items-center gap-2 rounded-full bg-teal px-[14px] py-2 text-[13px] font-semibold text-white">
                <span className="live-dot h-2 w-2 rounded-full bg-cyan-pale" />
                OpenSwarm agents
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-navy-2 px-[14px] py-2 text-[13px] text-on-navy">
                <span className="h-2 w-2 rounded-full" style={{ background: "#93A8C4" }} />
                Single model call or rules
              </span>
            </div>
          </div>

          {/* Today panel */}
          <div className="rise min-w-0 rounded-[20px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl" style={{ flex: "1 1 420px", animationDelay: "200ms" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="font-mono text-[11px] tracking-[0.1em] text-cyan">LIVE DEMO CLINIC</span>
                <span className="text-[13px] text-muted-2">Sample data · {dayEyebrow(DEFAULT_DAY)}</span>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-teal/30 px-3 py-1 text-[12px] font-semibold text-cyan-pale">
                <span className="live-dot h-[7px] w-[7px] rounded-full bg-cyan-pale" />
                Live
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {kpis.map((k) => (
                <Link key={k.label} href={k.href} className="group flex flex-col gap-1 rounded-[14px] border border-white/10 bg-navy/60 p-4 no-underline transition-colors hover:border-cyan/40 hover:bg-navy-2/80">
                  <span className="flex items-center justify-between">
                    <Icon name={k.icon} size={18} color={k.tone} />
                    <span className="text-[12px] text-muted-2 opacity-0 transition-opacity group-hover:opacity-100">Open →</span>
                  </span>
                  <span className="text-[34px] font-extrabold leading-none text-white">
                    <CountUp value={k.value} />
                  </span>
                  <span className="text-[12px] leading-snug text-on-navy">{k.label}</span>
                </Link>
              ))}
            </div>
            {run ? (
              <div className="mt-4 rounded-[14px] border border-white/10 bg-navy/60">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-[10px]">
                  <span className="text-[13px] font-bold text-white">Diagnostic swarm · {run.patientId}</span>
                  <span className="font-mono text-[11px] text-muted-2">{run.agents.length} agents</span>
                </div>
                <ul className="m-0 flex list-none flex-col p-0">
                  {run.agents.map((a, i) => (
                    <li key={a.id} className="ticker-row flex items-center gap-3 border-b border-white/5 px-4 py-[7px] text-[12px] last:border-0" style={{ animationDelay: `${500 + i * 90}ms` }}>
                      <span className={`h-2 w-2 flex-none rounded-full ${a.status === "flag" ? "ping" : ""}`} style={{ background: AGENT_DOT[a.status] ?? "#38BDCF" }} />
                      <span className="flex-1 truncate text-on-navy">{a.name}</span>
                      <span className="whitespace-nowrap font-semibold" style={{ color: a.status === "flag" ? "#FDBA74" : a.status === "skip" ? "#8FA3BD" : "#7DD3E0" }}>
                        {a.badge}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Trust strip */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-[1600px] gap-6 px-16 py-8 max-[800px]:px-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {trust.map((t, i) => (
            <Reveal key={t.title} delay={i * 80} className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-teal-tint">
                <Icon name={t.icon} size={20} color="#0B7285" />
              </div>
              <div className="flex flex-col gap-[2px]">
                <span className="text-[14px] font-bold">{t.title}</span>
                <span className="text-[13px] leading-[1.5] text-muted">{t.body}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Flow */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-[30px] px-16 py-12 max-[800px]:px-4 max-[800px]:py-8">
        <Reveal className="flex flex-col gap-2">
          <h2 className="m-0 text-[30px] font-extrabold tracking-[-0.01em]">How a patient moves through your practice</h2>
          <p className="m-0 max-w-[720px] text-[15px] leading-[1.6] text-ink-2">Seven steps share one record. Dark cards are agent swarms; light cards are a single model call or rules. Click any step to open it.</p>
        </Reveal>
        {FLOW_ROWS.map((row) => (
          <section key={row.eyebrow} className="flex flex-col gap-[14px]">
            <Reveal className="flex items-center gap-3 font-mono text-[12px] tracking-[0.1em] text-muted">
              <span className="h-[2px] w-6 bg-teal" />
              {row.eyebrow}
            </Reveal>
            <div className="flex items-stretch max-[800px]:flex-col max-[800px]:gap-4">
              {row.steps.map((s, i) => (
                <Reveal key={s.num} delay={i * 110} className="flex min-w-0 items-stretch" >
                  <StepCard s={s} />
                  {s.arrow ? <Arrow /> : null}
                </Reveal>
              ))}
              {row.loopsBack ? (
                <Reveal delay={row.steps.length * 110} className="flex min-w-0 items-stretch">
                  <Arrow dashed />
                  <Link
                    href={row.loopsBack.href}
                    className="lift group box-border flex w-[316px] min-w-[200px] max-w-full flex-shrink flex-col justify-center gap-[10px] rounded-[16px] p-[22px] text-ink no-underline hover:text-ink max-[800px]:w-full max-[800px]:min-w-0"
                    style={{ border: "1.5px dashed #8FA3BD" }}
                  >
                    <div className="flex items-center gap-[10px] text-[16px] font-bold">
                      <Icon name="loop" size={20} color="#0B7285" className="transition-transform duration-500 group-hover:-rotate-180" />
                      {row.loopsBack.title}
                    </div>
                    <p className="m-0 text-[14px] leading-[1.55] text-ink-2">{row.loopsBack.body}</p>
                  </Link>
                </Reveal>
              ) : null}
            </div>
          </section>
        ))}

        <Reveal className="mt-auto">
          <div className="flex flex-wrap items-center gap-x-[22px] gap-y-2 rounded-[16px] border border-border bg-white px-6 py-[18px] text-[14px] text-ink-2 shadow-card">
            <div className="flex items-center gap-[10px] font-bold text-ink">
              <Icon name="shieldCheck" size={22} color="#0B7285" />
              Shared, compliant layer
            </div>
            {COMPLIANCE_ITEMS.map((t, i) => (
              <span key={t} className="contents">
                {i > 0 ? <span style={{ color: "#A7B4C6" }}>·</span> : null}
                <span>{t}</span>
              </span>
            ))}
          </div>
        </Reveal>
      </div>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-16 py-5 text-[12px] text-muted max-[800px]:px-5">
          <span>HouseAI Dental · Clinical AI for dental practices</span>
          <span>Powered by HouseAI · Decision support only; the dentist confirms every finding.</span>
        </div>
      </footer>
    </div>
  );
}

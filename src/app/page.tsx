import Link from "next/link";
import { Icon, LogoTile } from "@/components/icons";
import { FLOW_ROWS, COMPLIANCE_ITEMS, type FlowStep } from "@/content/flow";
import { TopNav } from "@/components/TopNav";
import { navItems } from "@/lib/nav";

export const dynamic = "force-dynamic";

function Arrow({ dashed = false }: { dashed?: boolean }) {
  return (
    <div className="flex w-[44px] flex-none items-center justify-center max-[800px]:hidden" aria-hidden="true">
      <svg width="34" height="14" viewBox="0 0 34 14" fill="none" stroke="#8FA3BD" strokeWidth="1.8" strokeDasharray={dashed ? "3 3" : undefined}>
        <path d={dashed ? "M1 7h30" : "M1 7h30M25 2l6 5-6 5"} />
      </svg>
    </div>
  );
}

function StepCard({ s }: { s: FlowStep }) {
  const sw = !!s.swarm;
  return (
    <Link
      href={s.href}
      className={`box-border flex w-[316px] min-w-[200px] max-w-full flex-shrink flex-col gap-3 max-[800px]:w-full max-[800px]:min-w-0 rounded-[16px] p-[22px] no-underline transition-transform hover:-translate-y-0.5 ${
        sw ? "bg-navy text-white hover:text-white" : "border border-border bg-white text-ink hover:text-ink"
      }`}
      style={{
        boxShadow: sw ? "0 10px 30px rgba(11,31,58,0.25)" : "0 1px 2px rgba(11,31,58,0.05), 0 8px 24px rgba(11,31,58,0.05)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className={`flex h-[44px] w-[44px] items-center justify-center rounded-[12px] ${sw ? "bg-teal" : "bg-p3-tint"}`}>
          <Icon name={s.icon} size={22} color={sw ? "#FFFFFF" : "#1A56DB"} />
        </div>
        <span className={`rounded-full px-[10px] py-1 text-[12px] font-semibold ${sw ? "bg-teal text-white" : "bg-chip text-ink-2"}`}>{s.tag}</span>
      </div>
      <div className="flex items-baseline gap-[10px]">
        <span className="whitespace-nowrap font-mono text-[13px]" style={{ color: sw ? "#7DD3E0" : "#52627A" }}>
          {s.num}
        </span>
        <h2 className="m-0 text-[21px] font-bold">{s.title}</h2>
      </div>
      <p className="m-0 text-[14px] leading-[1.55]" style={{ color: sw ? "#C9D6E8" : "#3A4A60" }}>
        {s.body}
      </p>
      <div
        className="mt-auto border-t pt-3 text-[13px] font-semibold"
        style={{ borderColor: sw ? "#1E3E66" : "#E6ECF2", color: sw ? "#7DD3E0" : "#52627A" }}
      >
        {s.out}
      </div>
    </Link>
  );
}

export default async function FlowPage() {
  const items = await navItems();
  return (
    <div className="box-border flex min-h-screen flex-col bg-bg text-ink">
      <div className="border-b border-navy-line bg-navy px-16 py-2 max-[800px]:px-3">
        <TopNav items={items} />
      </div>
      <header className="relative flex flex-wrap items-end justify-between gap-8 overflow-hidden bg-navy px-16 pb-10 pt-11 text-white max-[800px]:px-5 max-[800px]:pt-8">
        <svg
          width="1600"
          height="120"
          viewBox="0 0 1600 120"
          fill="none"
          className="pointer-events-none absolute bottom-0 left-0 opacity-35"
          aria-hidden="true"
        >
          <path d="M0 80 H520 L540 80 L556 40 L572 108 L588 20 L604 96 L616 80 H1040 L1056 80 L1068 56 L1080 96 L1092 80 H1600" stroke="#38BDCF" strokeWidth="2" />
        </svg>
        <div className="relative flex items-center gap-5">
          <LogoTile size={64} radius={18} glyph={34} />
          <div className="flex flex-col gap-[6px]">
            <div className="font-mono text-[13px] tracking-[0.1em] text-cyan">HOUSEAI DENTAL · CLINICAL FLOW</div>
            <h1 className="m-0 text-[44px] font-extrabold leading-[1.15] tracking-[-0.02em] max-[800px]:text-[30px]">From X-ray to follow-up, one record</h1>
          </div>
        </div>
        <div className="relative flex flex-wrap gap-[10px]">
          <span className="inline-flex items-center gap-2 rounded-full bg-teal px-[14px] py-2 text-[13px] font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-cyan-pale" />
            OpenSwarm agents
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-navy-2 px-[14px] py-2 text-[13px] text-on-navy">
            <span className="h-2 w-2 rounded-full" style={{ background: "#93A8C4" }} />
            Single model call or rules
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-[30px] px-16 py-10 max-[800px]:px-4 max-[800px]:py-6">
        {FLOW_ROWS.map((row) => (
          <section key={row.eyebrow} className="flex flex-col gap-[14px]">
            <div className="flex items-center gap-3 font-mono text-[12px] tracking-[0.1em] text-muted">
              <span className="h-[2px] w-6 bg-teal" />
              {row.eyebrow}
            </div>
            <div className="flex items-stretch max-[800px]:flex-col max-[800px]:gap-4">
              {row.steps.map((s) => (
                <div key={s.num} className="flex min-w-0 items-stretch" style={{ flex: "0 1 auto" }}>
                  <StepCard s={s} />
                  {s.arrow ? <Arrow /> : null}
                </div>
              ))}
              {row.loopsBack ? (
                <>
                  <Arrow dashed />
                  <Link
                    href={row.loopsBack.href}
                    className="box-border flex w-[316px] min-w-[200px] max-w-full flex-shrink flex-col justify-center gap-[10px] max-[800px]:w-full max-[800px]:min-w-0 rounded-[16px] p-[22px] text-ink no-underline hover:text-ink"
                    style={{ border: "1.5px dashed #8FA3BD" }}
                  >
                    <div className="flex items-center gap-[10px] text-[16px] font-bold">
                      <Icon name="loop" size={20} color="#0B7285" />
                      {row.loopsBack.title}
                    </div>
                    <p className="m-0 text-[14px] leading-[1.55] text-ink-2">{row.loopsBack.body}</p>
                  </Link>
                </>
              ) : null}
            </div>
          </section>
        ))}

        <div className="mt-auto flex flex-wrap items-center gap-x-[22px] gap-y-2 rounded-[16px] border border-border bg-white px-6 py-[18px] text-[14px] text-ink-2 shadow-card">
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
      </div>
    </div>
  );
}

import { Icon } from "@/components/icons";

/*
 * Small product vignettes for the feature grid. Pure markup; their animations are CSS
 * keyed off the `.in` class that <Reveal> adds to the surrounding card.
 */

export function SwarmVisual({ agents }: { agents: string[] }) {
  const ys = agents.map((_, i) => 34 + i * (192 / Math.max(1, agents.length - 1)));
  const paths = ys.map((y) => `M178 ${y} C250 ${y} 250 130 318 130`);
  return (
    <svg viewBox="0 0 640 260" className="block h-auto w-full min-w-[520px]" role="img" aria-label="Specialist agents feed a skeptic, then a consensus agent">
      {paths.map((d, i) => (
        <g key={i}>
          <path d={d} stroke="var(--lp-line-strong)" strokeWidth="1.2" fill="none" />
          <circle r="3" fill="var(--lp-accent)">
            <animateMotion dur="2.6s" repeatCount="indefinite" begin={`${i * 0.37}s`} path={d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
          </circle>
        </g>
      ))}
      <path d="M438 130 H486" stroke="var(--lp-line-strong)" strokeWidth="1.2" />
      <circle r="3" fill="var(--lp-accent)">
        <animateMotion dur="1.3s" repeatCount="indefinite" path="M438 130 H486" />
      </circle>
      {agents.map((a, i) => (
        <g key={a} className="sv-chip" style={{ animationDelay: `${i * 90}ms` }}>
          <rect x="18" y={ys[i] - 15} width="160" height="30" rx="8" fill="var(--lp-surface)" stroke="var(--lp-line)" />
          <circle cx="36" cy={ys[i]} r="3.5" fill="var(--lp-accent)" opacity="0.8" />
          <text x="48" y={ys[i] + 4} fontSize="12" fill="var(--lp-ink)" fontFamily="var(--font-geist), sans-serif">
            {a}
          </text>
        </g>
      ))}
      <g className="sv-chip" style={{ animationDelay: "500ms" }}>
        <rect x="318" y="110" width="120" height="40" rx="10" fill="var(--lp-surface)" stroke="var(--lp-ink)" strokeWidth="1.2" />
        <text x="378" y="134" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--lp-ink)" fontFamily="var(--font-geist), sans-serif">
          Skeptic
        </text>
      </g>
      <g className="sv-chip" style={{ animationDelay: "650ms" }}>
        <rect x="486" y="106" width="136" height="48" rx="12" fill="var(--lp-ink)" />
        <text x="554" y="128" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff" fontFamily="var(--font-geist), sans-serif">
          Consensus
        </text>
        <text x="554" y="144" textAnchor="middle" fontSize="10" fill="#9AA6B8" fontFamily="var(--font-plex-mono), monospace">
          by tooth number
        </text>
      </g>
      <g className="sv-chip" style={{ animationDelay: "800ms" }}>
        <rect x="486" y="176" width="136" height="54" rx="10" fill="var(--lp-surface)" stroke="var(--lp-line)" />
        <text x="500" y="196" fontSize="10" fill="var(--lp-faint)" fontFamily="var(--font-plex-mono), monospace">
          #30 · P1
        </text>
        <text x="500" y="214" fontSize="12" fontWeight="500" fill="var(--lp-ink)" fontFamily="var(--font-geist), sans-serif">
          Periapical lesion
        </text>
        <rect x="586" y="186" width="26" height="14" rx="4" fill="var(--lp-accent-tint)" />
        <text x="599" y="196" textAnchor="middle" fontSize="9" fill="var(--lp-accent)" fontFamily="var(--font-plex-mono), monospace">
          3/3
        </text>
      </g>
      <path d="M554 154 V176" stroke="var(--lp-line-strong)" strokeWidth="1.2" strokeDasharray="3 3" />
    </svg>
  );
}

const OCR_FIELDS = [
  { label: "Member ID", value: "XKD 482 991 03" },
  { label: "Group", value: "77120-B" },
  { label: "Date of birth", value: "1986-03-14" },
  { label: "Carrier", value: "Demo Dental PPO", low: true },
];

export function IntakeVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div className="relative overflow-hidden rounded-xl border border-lp-line bg-lp-surface p-4 shadow-[0_1px_2px_rgba(11,18,32,0.04),0_12px_32px_-12px_rgba(11,18,32,0.12)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-lp-faint">Insurance card</span>
          <Icon name="scan" size={15} color="#8A94A6" />
        </div>
        <dl className="m-0 grid gap-[10px]">
          {OCR_FIELDS.map((f, i) => (
            <div key={f.label} className="flex items-center justify-between gap-3">
              <dt className="text-[12px] text-lp-faint">{f.label}</dt>
              <dd className="relative m-0 flex items-center gap-2">
                <span className="ocr-skeleton absolute right-0 h-[10px] w-[96px] rounded bg-lp-chip" style={{ animationDelay: `${300 + i * 260}ms` }} />
                <span className="ocr-value font-mono text-[12px] text-lp-ink" style={{ animationDelay: `${300 + i * 260}ms` }}>
                  {f.value}
                </span>
                {f.low ? (
                  <span className="ocr-value rounded bg-[#FFF4E5] px-[6px] py-[1px] text-[10px] font-medium text-[#B45309]" style={{ animationDelay: `${300 + i * 260 + 200}ms` }}>
                    Confirm
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
        <div className="ocr-scan pointer-events-none absolute inset-x-0 h-10" aria-hidden="true" />
      </div>
    </div>
  );
}

const BLOCKS = [
  { col: 0, top: 0, h: 3, label: "Root canal #30", tone: "p1" },
  { col: 1, top: 0, h: 2, label: "Extraction #17", tone: "p2" },
  { col: 2, top: 0, h: 1, label: "Cleaning", tone: "p4" },
  { col: 2, top: 1, h: 1, label: "Checkup", tone: "p4" },
  { col: 1, top: 2, h: 2, label: "Crown prep #3", tone: "p3" },
  { col: 0, top: 3, h: 1, label: "ER hold", tone: "hold" },
  { col: 2, top: 2, h: 1, label: "Cleaning", tone: "p4" },
  { col: 0, top: 4, h: 1, label: "Filling #14", tone: "p3" },
  { col: 2, top: 3, h: 2, label: "New patient", tone: "p4" },
  { col: 1, top: 4, h: 1, label: "Checkup", tone: "p4" },
];

export function CalendarVisual() {
  const row = 30;
  return (
    <div className="w-full">
      <div className="mb-2 grid grid-cols-[34px_1fr_1fr_1fr] gap-[6px] text-[11px] text-lp-faint">
        <span />
        <span>Chair 1</span>
        <span>Chair 2</span>
        <span>Hygiene</span>
      </div>
      <div className="grid grid-cols-[34px_1fr] gap-[6px]">
        <div className="flex flex-col font-mono text-[10px] text-lp-faint">
          {["8:00", "9:00", "10:00", "11:00", "12:00"].map((t) => (
            <span key={t} style={{ height: row }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative grid grid-cols-3 gap-[6px]" style={{ height: row * 5 }}>
          {[0, 1, 2].map((c) => (
            <div key={c} className="rounded-md bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_29px,var(--lp-line)_29px,var(--lp-line)_30px)]" />
          ))}
          {BLOCKS.map((b, i) => (
            <div
              key={i}
              className={`cal-block cb-${b.tone} absolute flex items-start overflow-hidden rounded-md px-2 py-[5px] text-[11px] font-medium leading-tight`}
              style={{ left: `calc(${b.col} * (100% + 6px) / 3)`, width: "calc((100% - 12px) / 3)", top: b.top * row + 1, height: b.h * row - 3, animationDelay: `${200 + i * 110}ms` }}
            >
              <span className="line-clamp-2">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const LANES = [
  { name: "Eligibility", result: "Verified", tone: "ok" },
  { name: "Copay estimate", result: "$84 patient", tone: "ok" },
  { name: "Dual coverage", result: "Primary set", tone: "ok" },
  { name: "Pre-approval", result: "Retry 14:00", tone: "warn" },
];

export function InsuranceVisual() {
  return (
    <ul className="m-0 flex w-full list-none flex-col gap-[10px] p-0">
      {LANES.map((l, i) => (
        <li key={l.name} className="flex items-center gap-3 rounded-lg border border-lp-line bg-lp-surface px-3 py-[9px]">
          <span className="w-[104px] flex-none text-[12px] font-medium text-lp-ink">{l.name}</span>
          <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-lp-chip">
            <span className={`lane-bar absolute inset-y-0 left-0 rounded-full ${l.tone === "warn" ? "bg-[#F59E0B]" : "bg-lp-accent"}`} style={{ animationDelay: `${200 + i * 300}ms`, ["--to" as string]: l.tone === "warn" ? "62%" : "100%" }} />
          </span>
          <span className={`lane-result whitespace-nowrap font-mono text-[11px] ${l.tone === "warn" ? "text-[#B45309]" : "text-lp-accent"}`} style={{ animationDelay: `${1100 + i * 300}ms` }}>
            {l.result}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function FollowupVisual() {
  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-xl border border-lp-line bg-lp-surface shadow-[0_1px_2px_rgba(11,18,32,0.04),0_12px_32px_-12px_rgba(11,18,32,0.12)]">
      <div className="flex items-center justify-between border-b border-lp-line px-4 py-[10px]">
        <span className="text-[12px] font-medium text-lp-ink">How your root canal heals</span>
        <span className="font-mono text-[10px] text-lp-faint">+24 h</span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="fu-line h-[7px] w-[92%] rounded bg-lp-chip" style={{ animationDelay: "200ms" }} />
        <div className="fu-line h-[7px] w-[78%] rounded bg-lp-chip" style={{ animationDelay: "320ms" }} />
        <div className="fu-line relative flex h-[84px] items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0B1F3A,#0B7285)]" style={{ animationDelay: "460ms" }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90">
            <Icon name="play" size={14} color="#0B1F3A" />
          </span>
          <span className="absolute bottom-2 right-2 font-mono text-[10px] text-white/70">1:12</span>
        </div>
        <div className="fu-line h-[7px] w-[64%] rounded bg-lp-chip" style={{ animationDelay: "600ms" }} />
        <span className="fu-line inline-flex h-8 items-center justify-center self-start rounded-md bg-lp-ink px-3 text-[12px] font-medium text-white" style={{ animationDelay: "760ms" }}>
          Book your next check
        </span>
      </div>
    </div>
  );
}

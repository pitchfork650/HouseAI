"use client";

import { useEffect, useState } from "react";
import { Icon, LogoTile, type IconName } from "@/components/icons";
import { SyntheticPano } from "@/components/diagnostics/Pano";
import type { OverlayShape } from "@/lib/pano";
import { useInView, usePrefersReducedMotion } from "./Motion";

export type DemoAgent = { name: string; badge: string; status: string };
export type DemoFinding = { teeth: number[]; priority: string; title: string; suggested: string; agreement: number; overlay: OverlayShape[] };

const STROKE: Record<string, string> = { P1: "#FB923C", P2: "#FBBF24", P3: "#60A5FA", P4: "#C9D6E8" };
const PILL: Record<string, string> = { P1: "bg-[#FB923C]/15 text-[#FDBA74]", P2: "bg-[#FBBF24]/15 text-[#FCD34D]", P3: "bg-[#60A5FA]/15 text-[#93C5FD]", P4: "bg-white/10 text-[#C9D6E8]" };
const RAIL: IconName[] = ["flow", "scanNav", "calendar", "shieldCheck", "upload", "mail"];

const TICK = 100;
const START = 500;
const STAGGER = 520;
const RUN_FOR = 900;

/** The hero product shot: a scripted, looping replay of a diagnostic swarm run on the demo pano. */
export function HeroDemo({ patientId, dayLabel, agents, findings }: { patientId: string; dayLabel: string; agents: DemoAgent[]; findings: DemoFinding[] }) {
  const [ref, inView] = useInView<HTMLDivElement>({ repeat: true, margin: "0px" });
  const reduce = usePrefersReducedMotion();
  const allDone = START + (agents.length - 1) * STAGGER + RUN_FOR;
  const consensusAt = allDone + 300;
  const signAt = allDone + 1700;
  const cycle = allDone + 5200;
  const [t, setT] = useState(0);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    const id = setInterval(() => {
      setT((x) => {
        if (x + TICK >= cycle) {
          setLoop((l) => l + 1);
          return 0;
        }
        return x + TICK;
      });
    }, TICK);
    return () => clearInterval(id);
  }, [reduce, inView, cycle]);

  const now = reduce ? cycle - 1 : t;
  const findingAt = (j: number) => START + 900 + j * ((allDone - START - 900) / Math.max(1, findings.length));
  const fading = !reduce && now > cycle - 500;
  const shown = findings.filter((_, j) => now >= findingAt(j));

  return (
    <div ref={ref} className="hero-window overflow-hidden rounded-[14px] border border-white/10 bg-[#0A1424] text-white">
      {/* Window chrome */}
      <div className="flex h-10 items-center gap-3 border-b border-white/[0.07] bg-[#0C182B] px-4">
        <div className="flex gap-[6px]" aria-hidden="true">
          <span className="h-[10px] w-[10px] rounded-full bg-white/15" />
          <span className="h-[10px] w-[10px] rounded-full bg-white/15" />
          <span className="h-[10px] w-[10px] rounded-full bg-white/15" />
        </div>
        <div className="mx-auto flex h-6 min-w-0 max-w-[360px] flex-1 items-center justify-center rounded-md bg-white/[0.05] px-3 font-mono text-[11px] text-white/45">
          <span className="truncate">app.houseai.dental/diagnostics/{patientId}</span>
        </div>
        <div className="w-[42px]" />
      </div>

      <div className="flex">
        {/* App rail */}
        <div className="flex w-14 flex-none flex-col items-center gap-2 border-r border-white/[0.07] py-4 max-[720px]:hidden" aria-hidden="true">
          <LogoTile size={28} radius={8} glyph={16} />
          <div className="mt-3 flex flex-col gap-1">
            {RAIL.map((n) => (
              <span key={n} className={`flex h-9 w-9 items-center justify-center rounded-lg ${n === "scanNav" ? "bg-white/[0.08]" : ""}`}>
                <Icon name={n} size={17} color={n === "scanNav" ? "#7DD3E0" : "rgba(255,255,255,0.35)"} />
              </span>
            ))}
          </div>
        </div>

        <div className={`min-w-0 flex-1 transition-opacity duration-500 ${fading ? "opacity-40" : "opacity-100"}`}>
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="whitespace-nowrap text-[13px] font-medium text-white">Panoramic X-ray</span>
              <span className="truncate font-mono text-[11px] text-white/40 max-[560px]:hidden">
                {patientId} · {dayLabel}
              </span>
            </div>
            <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-[10px] py-1 text-[11px] font-medium transition-colors duration-500 ${now >= consensusAt ? "bg-[#38BDCF]/15 text-[#A5F3FC]" : "bg-white/[0.06] text-white/60"}`}>
              <span className={`h-[6px] w-[6px] rounded-full ${now >= consensusAt ? "bg-[#38BDCF]" : "demo-blink bg-[#FBBF24]"}`} />
              {now >= consensusAt ? `Consensus · ${findings.length} findings` : "Swarm reading…"}
            </span>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_280px] max-[900px]:grid-cols-1">
            {/* Pano + findings */}
            <div className="min-w-0 border-r border-white/[0.07] p-4 max-[900px]:border-r-0">
              <div className="relative overflow-hidden rounded-lg bg-black">
                <svg viewBox="0 0 800 400" className="block h-auto w-full" role="img" aria-label="Synthetic panoramic dental X-ray with AI findings outlined">
                  <SyntheticPano />
                  {findings.map((f, j) =>
                    f.overlay.map((s, k) => {
                      const on = now >= findingAt(j);
                      const c = STROKE[f.priority] ?? STROKE.P4;
                      const common = { fill: "none", stroke: c, strokeWidth: 2, pathLength: 1, className: `demo-draw ${on ? "on" : ""}` };
                      return (
                        <g key={`${j}-${k}`}>
                          {s.kind === "box" ? <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="6" {...common} /> : <circle cx={s.x} cy={s.y} r={s.r} {...common} />}
                          <text x={s.lx} y={s.ly} fill={c} fontFamily="var(--font-plex-mono), monospace" fontSize="11" className={`demo-fade ${on ? "on" : ""}`}>
                            {s.label}
                          </text>
                        </g>
                      );
                    }),
                  )}
                </svg>
                {!reduce ? <div key={loop} className="demo-scan pointer-events-none absolute inset-y-0 w-[18%]" aria-hidden="true" /> : null}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 max-[560px]:grid-cols-1">
                {findings.slice(0, 3).map((f, j) => {
                  const on = shown.includes(f);
                  const signed = j === 0 && now >= signAt;
                  return (
                    <div key={j} className={`demo-card ${j === 2 ? "max-[560px]:hidden" : ""} flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 ${on ? "on" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-white/50">#{f.teeth.join(", #")}</span>
                        <span className={`rounded px-[6px] py-[1px] font-mono text-[10px] ${PILL[f.priority] ?? PILL.P4}`}>{f.priority}</span>
                      </div>
                      <div className="truncate text-[12px] font-medium text-white/90">{f.title}</div>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <span className="text-[11px] text-white/40">{f.agreement}/3 agree</span>
                        {j === 0 ? (
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[11px] font-medium transition-all duration-300 ${signed ? "bg-[#34D399]/15 text-[#6EE7B7]" : "bg-white/[0.08] text-white/70"} ${now >= signAt - 250 && now < signAt ? "scale-95" : ""}`}>
                            {signed ? <Icon name="check" size={12} color="#6EE7B7" /> : null}
                            {signed ? "Signed off" : "Sign off"}
                          </span>
                        ) : (
                          <span className="text-[11px] text-white/40">Awaiting dentist</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agents */}
            <div className="flex min-w-0 flex-col p-4 max-[900px]:border-t max-[900px]:border-white/[0.07]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-medium text-white/80">Diagnostic swarm</span>
                <span className="font-mono text-[11px] text-white/35">{agents.length} agents</span>
              </div>
              <ul className="m-0 flex list-none flex-col gap-[2px] p-0">
                {agents.map((a, i) => {
                  const begin = START + i * STAGGER;
                  const state = a.status === "skip" ? (now >= begin ? "skip" : "queued") : now >= begin + RUN_FOR ? a.status : now >= begin ? "running" : "queued";
                  const done = state !== "queued" && state !== "running";
                  const tone = state === "flag" ? "text-[#FDBA74]" : state === "skip" ? "text-white/35" : "text-[#7DD3E0]";
                  return (
                    <li key={a.name} className={`flex items-center gap-3 rounded-md px-2 py-[7px] text-[12px] transition-colors duration-300 ${state === "running" ? "bg-white/[0.05]" : ""}`}>
                      <span className="flex h-4 w-4 flex-none items-center justify-center">
                        {state === "running" ? (
                          <span className="demo-spin h-3 w-3 rounded-full border-[1.5px] border-white/20 border-t-[#7DD3E0]" />
                        ) : done ? (
                          <span className={`h-[7px] w-[7px] rounded-full ${state === "flag" ? "bg-[#FB923C]" : state === "skip" ? "bg-white/25" : "bg-[#38BDCF]"}`} />
                        ) : (
                          <span className="h-[7px] w-[7px] rounded-full border border-white/20" />
                        )}
                      </span>
                      <span className={`flex-1 truncate transition-colors duration-300 ${state === "queued" ? "text-white/35" : "text-white/85"}`}>{a.name}</span>
                      <span className={`whitespace-nowrap font-mono text-[11px] transition-opacity duration-300 ${done ? `opacity-100 ${tone}` : "opacity-0"}`}>{a.badge}</span>
                    </li>
                  );
                })}
              </ul>
              <div className={`mt-auto rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-[11px] leading-[1.5] text-white/55 transition-all duration-500 max-[900px]:mt-3 ${now >= consensusAt ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
                <span className="text-white/85">Consensus agent:</span> {findings.length} findings explained by tooth number. Nothing reaches the chart until the dentist signs off.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

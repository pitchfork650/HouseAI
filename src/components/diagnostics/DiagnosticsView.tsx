"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { AllergyChip, btnPrimary, btnSecondary, Card, Chip, PatientHeader, PriorityPill } from "@/components/ui";
import { PRIO, asPriority } from "@/lib/priority";
import type { RunView } from "@/lib/views";
import type { OverlayShape } from "@/lib/pano";
import { FAMILY_TEXT, type Comparison } from "@/lib/ground-truth";
import { FRAME, fit } from "@/lib/xray-frame";
import { Overlay, SyntheticPano } from "./Pano";

export type StudyView = { id: string; type: string; takenAt: string; synthetic: boolean; width?: number | null; height?: number | null } | null;

const TYPE_LABEL: Record<string, string> = { pano: "PANORAMIC", bitewing: "BITEWINGS", pa: "PERIAPICAL", cbct: "CBCT", intraoral: "INTRAORAL" };

/** Expert labels for a public-dataset X-ray, in the viewer frame, plus how the latest run scored. */
export type TruthView = { source: string; overlays: OverlayShape[]; comparison: Comparison | null; model: string | null } | null;

export type HeaderView = { initials: string; name: string; sub: string; allergies: string[]; chips: string[] };

export function DiagnosticsView({ patientId, header, run: initialRun, study, truth = null }: { patientId: string; header: HeaderView; run: RunView | null; study: StudyView; truth?: TruthView }) {
  const router = useRouter();
  const [run, setRun] = useState<RunView | null>(initialRun);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setRun(initialRun), [initialRun]);

  const watch = useCallback(
    (runId: string) => {
      if (poll.current) clearInterval(poll.current);
      poll.current = setInterval(async () => {
        const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as RunView;
        setRun(next);
        if (next.status !== "running") {
          clearInterval(poll.current!);
          poll.current = null;
          router.refresh();
        }
      }, 700);
    },
    [router],
  );

  useEffect(() => {
    if (initialRun?.status === "running") watch(initialRun.id);
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [initialRun, watch]);

  async function rerun() {
    setBusy("rerun");
    setNotice(null);
    const res = await fetch(`/api/diagnostics/${patientId}/run`, { method: "POST" });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) return setNotice(body.error ?? "Could not start the swarm.");
    const fresh = await fetch(`/api/runs/${body.runId}`, { cache: "no-store" }).then((r) => r.json());
    setRun(fresh);
    watch(body.runId);
  }

  async function post(action: string, url: string, payload: unknown, ok: (b: Record<string, unknown>) => string) {
    setBusy(action);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json();
    setBusy(null);
    setNotice(res.ok ? ok(body) : (body.error as string) ?? "Something went wrong.");
    if (res.ok) router.refresh();
  }

  const running = run?.status === "running";
  const findings = run?.findings ?? [];
  const paFinding = findings.find((f) => f.prerequisite === "D0220");

  return (
    <>
      <PatientHeader
        initials={header.initials}
        name={header.name}
        sub={header.sub}
        chips={
          <>
            {header.allergies.map((a) => (
              <AllergyChip key={a}>Allergy: {a}</AllergyChip>
            ))}
            {header.chips.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </>
        }
        right={
          <>
            <UploadButton patientId={patientId} onDone={(msg) => { setNotice(msg); router.refresh(); }} />
            <button className={`${btnPrimary} px-4`} onClick={rerun} disabled={busy === "rerun" || running}>
              {running ? "Swarm running…" : "Re-run swarm"}
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-col gap-4" style={{ flex: "999 1 600px" }}>
          <XrayViewer study={study} findings={findings} truth={truth} />
          {truth ? <TruthCard truth={truth} running={running} /> : null}
          <ToothChart findings={findings} />

          <Card className="overflow-hidden" >
            <div id="findings" className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-5 py-4">
              <h2 className="m-0 text-[16px] font-bold">Consensus findings</h2>
              <span className="text-[13px] text-muted">
                {run ? `${(run.summary.reported as number) ?? run.agents.filter((a) => a.status !== "skip").length} of ${run.agents.length} agents reported · ` : ""}
                agreement = reporter + Verifier + Skeptic · dentist review required
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-[14px]">
                <thead>
                  <tr className="bg-subtle text-left text-[11px] tracking-[0.08em] text-muted">
                    <th className="px-5 py-[10px] font-semibold">TOOTH</th>
                    <th className="px-3 py-[10px] font-semibold">FINDING</th>
                    <th className="px-3 py-[10px] font-semibold">AGREEMENT</th>
                    <th className="px-3 py-[10px] font-semibold">SUGGESTED</th>
                    <th className="px-5 py-[10px] font-semibold">PRIORITY</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.length === 0 ? (
                    <tr className="border-t border-row-line">
                      <td colSpan={5} className="px-5 py-4 text-muted">
                        {running ? "The swarm is reading the images…" : "No findings yet. Upload images and run the swarm."}
                      </td>
                    </tr>
                  ) : (
                    findings.map((f) => {
                      const c = PRIO[asPriority(f.priority)];
                      return (
                        <tr key={f.id} className="border-t border-row-line">
                          <td className="px-5 py-3 font-mono font-medium">{f.teeth.map((t) => `#${t}`).join(" ")}</td>
                          <td className="px-3 py-3">
                            {f.text}
                            {f.status !== "suggested" ? (
                              <span className="ml-2 rounded-full bg-teal-tint px-2 py-[1px] text-[11px] font-bold text-teal-dark">{f.status}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-[6px] w-16 overflow-hidden rounded-full bg-border-soft">
                                <div className="h-full rounded-full" style={{ width: `${Math.round((f.agreement / 3) * 100)}%`, background: c.solid }} />
                              </div>
                              <span className="font-mono text-[12px]">{f.agreement}/3</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-ink-2">{f.suggested}</td>
                          <td className="px-5 py-3">
                            <PriorityPill p={f.priority} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-[10px] border-t border-border-soft bg-subtle px-5 py-[14px]">
              <button
                className={`${btnPrimary} px-[18px]`}
                disabled={!run || running || !findings.some((f) => f.status === "suggested") || busy !== null}
                onClick={() =>
                  post("accept", `/api/diagnostics/${patientId}/accept`, { runId: run?.id }, (b) => `Added ${b.created} item(s) to the treatment plan.`)
                }
              >
                Accept into treatment plan
              </button>
              <Link href="/schedule" className={`${btnSecondary} px-[18px]`}>
                Send to calendar
              </Link>
              {paFinding ? (
                <button
                  className={`${btnSecondary} px-[18px]`}
                  disabled={busy !== null}
                  onClick={() =>
                    post("order", `/api/diagnostics/${patientId}/imaging-order`, { code: "D0220", teeth: paFinding.teeth }, () => `Periapical film ordered for ${paFinding.teeth.map((t) => `#${t}`).join(", ")}.`)
                  }
                >
                  Order periapical film for {paFinding.teeth.map((t) => `#${t}`).join(", ")}
                </button>
              ) : null}
              {notice ? (
                <span role="status" className="self-center text-[13px] font-semibold text-teal-dark">
                  {notice}
                </span>
              ) : null}
            </div>
          </Card>
        </section>

        <SwarmPanel run={run} />
      </div>
    </>
  );
}

function UploadButton({ patientId, onDone }: { patientId: string; onDone: (msg: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("pano");
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("type", type);
    const res = await fetch(`/api/patients/${patientId}/studies`, { method: "POST", body: fd });
    const body = await res.json();
    setBusy(false);
    setFile(null);
    onDone(res.ok ? `Uploaded ${body.type} image. Re-run the swarm to read it.` : body.error ?? "Upload failed.");
  }

  return (
    <>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {file ? (
        <span className="flex flex-wrap items-center gap-2">
          <select aria-label="Image type" value={type} onChange={(e) => setType(e.target.value)} className="min-h-[44px] rounded-[10px] border border-btn-border bg-white px-2 text-[14px]">
            <option value="pano">Panoramic</option>
            <option value="bitewing">Bitewing</option>
            <option value="pa">Periapical</option>
            <option value="cbct">CBCT slice</option>
            <option value="intraoral">Intraoral photo</option>
          </select>
          <button className={`${btnSecondary} px-4`} onClick={upload} disabled={busy}>
            {busy ? "Uploading…" : `Upload ${file.name.slice(0, 18)}`}
          </button>
        </span>
      ) : (
        <button className={`${btnSecondary} px-4`} onClick={() => input.current?.click()}>
          Upload images
        </button>
      )}
    </>
  );
}

function XrayViewer({ study, findings, truth }: { study: StudyView; findings: RunView["findings"]; truth: TruthView }) {
  const [overlay, setOverlay] = useState(true);
  const [labels, setLabels] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [measure, setMeasure] = useState(false);
  const label = study ? `${TYPE_LABEL[study.type] ?? study.type.toUpperCase()} · ${study.takenAt.slice(0, 10)} ${study.takenAt.slice(11, 16)}` : "NO IMAGES YET";
  // Real images are letterboxed into the 800×400 overlay frame; crop the view to the image itself.
  const box = study && !study.synthetic && study.width && study.height ? (() => { const f = fit(study.width, study.height); return { x: f.ox, y: f.oy, w: study.width * f.s, h: study.height * f.s }; })() : { x: 0, y: 0, w: FRAME.width, h: FRAME.height };
  const tool = (on: boolean) => `flex h-10 w-10 items-center justify-center rounded-[8px] border ${on ? "border-teal bg-[#0B2A33]" : "border-[#243246] bg-[#0D1520]"}`;

  return (
    <div className="overflow-hidden rounded-[16px] bg-[#05090F] shadow-navy-strong">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1A2533] px-[14px] py-[10px]">
        <span className="font-mono text-[12px] text-muted-2">{label}</span>
        <div className="ml-auto flex gap-[6px]">
          <button aria-label="Zoom" aria-pressed={zoom} className={tool(zoom)} onClick={() => setZoom((z) => !z)}>
            <Icon name="zoom" size={18} color="#C9D6E8" />
          </button>
          <button aria-label="Contrast" aria-pressed={contrast} className={tool(contrast)} onClick={() => setContrast((c) => !c)}>
            <Icon name="contrast" size={18} color="#C9D6E8" />
          </button>
          <button aria-label="Measure" aria-pressed={measure} className={tool(measure)} onClick={() => setMeasure((m) => !m)}>
            <Icon name="ruler" size={18} color="#C9D6E8" />
          </button>
          <button
            aria-pressed={overlay}
            onClick={() => setOverlay((o) => !o)}
            className={`h-10 rounded-[8px] border px-3 text-[13px] font-semibold ${overlay ? "border-teal bg-teal text-white" : "border-[#243246] bg-[#0D1520] text-on-navy"}`}
          >
            AI overlay {overlay ? "on" : "off"}
          </button>
          {truth ? (
            <button
              aria-pressed={labels}
              onClick={() => setLabels((l) => !l)}
              className={`h-10 rounded-[8px] border px-3 text-[13px] font-semibold ${labels ? "border-[#34D399] bg-[#0F2E25] text-[#6EE7B7]" : "border-[#243246] bg-[#0D1520] text-on-navy"}`}
            >
              Expert labels {labels ? "on" : "off"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="overflow-auto">
        <svg
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          width={zoom ? "160%" : "100%"}
          className="block"
          style={{ filter: contrast ? "contrast(1.5) brightness(1.1)" : undefined }}
          role="img"
          aria-label={study?.synthetic ? "Sample panoramic X-ray with AI-flagged regions" : "X-ray with AI-flagged regions"}
        >
          {study && !study.synthetic ? (
            <image href={`/api/studies/${study.id}/file`} x="0" y="0" width="800" height="400" preserveAspectRatio="xMidYMid meet" />
          ) : study ? (
            <SyntheticPano />
          ) : (
            <rect width="800" height="400" fill="#05090F" />
          )}
          {labels && truth
            ? truth.overlays.map((s, i) =>
                s.kind === "box" ? (
                  <g key={i}>
                    <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="4" fill="none" stroke="#34D399" strokeWidth="1.5" strokeDasharray="5 3" />
                    <text x={s.lx} y={s.ly} fill="#6EE7B7" fontFamily="var(--font-plex-mono), monospace" fontSize="10">
                      {s.label}
                    </text>
                  </g>
                ) : null,
              )
            : null}
          {overlay ? <Overlay findings={findings} /> : null}
          {measure ? (
            <text x="16" y="388" fill="#7DD3E0" fontFamily="var(--font-plex-mono), monospace" fontSize="11">
              measure: click two points (calibration needed for mm)
            </text>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

/** Scorecard: the latest swarm run against the dataset's expert labels (tooth + kind of problem). */
function TruthCard({ truth, running }: { truth: NonNullable<TruthView>; running: boolean }) {
  const c = truth.comparison;
  const total = c ? c.matched.length + c.missed.length : truth.overlays.length;
  const pill = (tone: string) => `inline-flex items-center gap-1 rounded-full px-[10px] py-[3px] text-[12px] font-semibold ${tone}`;
  return (
    <Card className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[16px] font-bold">Checked against expert labels</h2>
        <span className="text-[12px] text-muted">{truth.source}</span>
      </div>
      {running ? (
        <p className="m-0 text-[14px] text-ink-2">The swarm is reading this X-ray. The score appears when it finishes.</p>
      ) : !c ? (
        <p className="m-0 text-[14px] text-ink-2">Not read yet. Run the swarm to compare its findings with the {total} labelled problems on this X-ray.</p>
      ) : (
        <>
          <p className="m-0 text-[14px] text-ink-2">
            The swarm{truth.model && truth.model !== "mock" ? ` (${truth.model})` : truth.model === "mock" ? " (mock replay, not a real read)" : ""} found <b>{c.matched.length} of {total}</b> labelled problems
            {c.extra.length ? `, and flagged ${c.extra.length} the labels don't include` : ""}. {c.matched.concat(c.missed).some((x) => x.tooth != null) ? "Matching is by tooth and kind of problem." : "A lesion counts as found when an AI box of the same kind overlaps the experts' box."}
          </p>
          <div className="flex flex-col gap-2 text-[13px]">
            {[
              { title: "Found", items: c.matched, tone: "bg-[#E7F7EF] text-[#166534]" },
              { title: "Missed", items: c.missed, tone: "bg-p1-tint text-p1-text" },
              { title: "Not in labels", items: c.extra, tone: "bg-chip text-ink-2" },
            ].map((g) =>
              g.items.length ? (
                <div key={g.title} className="flex flex-wrap items-center gap-2">
                  <span className="w-[104px] flex-none font-semibold text-ink">{g.title}</span>
                  {g.items.map((x) => (
                    <span key={`${x.family}${x.tooth ?? x.ref}`} className={pill(g.tone)}>
                      {x.tooth != null ? `#${x.tooth}` : x.ref?.startsWith("L") ? x.ref : ""} {FAMILY_TEXT[x.family].toLowerCase()}
                    </span>
                  ))}
                </div>
              ) : null,
            )}
            {c.unscored.length ? <span className="text-[12px] text-muted">{c.unscored.length} finding(s) in categories DENTEX doesn&apos;t label (e.g. restoration margins) are not scored.</span> : null}
          </div>
        </>
      )}
    </Card>
  );
}

function ToothChart({ findings }: { findings: RunView["findings"] }) {
  const colorOf = new Map<number, string>();
  const rank = { P1: 0, P2: 1, P3: 2, P4: 3 } as Record<string, number>;
  for (const f of [...findings].sort((a, b) => rank[b.priority] - rank[a.priority])) for (const t of f.teeth) colorOf.set(t, PRIO[asPriority(f.priority)].solid);
  const upper = Array.from({ length: 16 }, (_, i) => i + 1);
  const lower = Array.from({ length: 16 }, (_, i) => 32 - i);
  const cell = (n: number) => {
    const c = colorOf.get(n);
    return (
      <div
        key={n}
        className="flex h-[34px] items-center justify-center rounded-[8px] font-mono text-[12px] font-semibold"
        style={c ? { background: c, color: "#FFFFFF" } : { background: "#F1F5F9", color: "#52627A", border: "1px solid #E2E8F0" }}
      >
        {n}
      </div>
    );
  };
  return (
    <Card className="flex flex-col gap-[10px] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <h2 className="m-0 text-[16px] font-bold">Tooth chart</h2>
        <div className="flex flex-wrap gap-[14px] text-[12px] text-muted">
          {[
            ["Urgent", "#C2410C"],
            ["Surgery", "#0B7285"],
            ["Restorative", "#1A56DB"],
          ].map(([l, c]) => (
            <span key={l} className="inline-flex items-center gap-[6px]">
              <span className="h-[10px] w-[10px] rounded-[3px]" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-[640px] flex-col gap-[6px]">
          <div className="grid grid-cols-16 gap-1">{upper.map(cell)}</div>
          <div className="grid grid-cols-16 gap-1">{lower.map(cell)}</div>
        </div>
      </div>
    </Card>
  );
}

const BADGE: Record<string, { bg: string; fg: string; dot: string }> = {
  done: { bg: "#0B7285", fg: "#FFFFFF", dot: "#38BDCF" },
  flag: { bg: "#FDEDE3", fg: "#9A3412", dot: "#FB923C" },
  failed: { bg: "#FDEDE3", fg: "#9A3412", dot: "#FB923C" },
  skip: { bg: "#1E3E66", fg: "#C9D6E8", dot: "#52627A" },
  running: { bg: "#13335E", fg: "#A5F3FC", dot: "#A5F3FC" },
  queued: { bg: "#13335E", fg: "#8FA3BD", dot: "#52627A" },
};

function SwarmPanel({ run }: { run: RunView | null }) {
  const running = run?.status === "running";
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  void tick;
  const secs = run ? Math.max(1, Math.round(((run.finishedAt ? Date.parse(run.finishedAt) : Date.now()) - Date.parse(run.startedAt)) / 1000)) : 0;
  const pill = !run ? "Not run yet" : running ? `Running · ${secs} s` : run.status === "failed" ? "Failed" : `Done in ${secs} s`;

  return (
    <aside className="min-w-0 overflow-hidden rounded-[16px] bg-navy text-on-navy shadow-navy" style={{ flex: "1 1 360px" }} aria-live="polite">
      <div className="flex items-center justify-between gap-[10px] border-b border-navy-3 px-5 py-[18px]">
        <div className="flex flex-col gap-[2px]">
          <h2 className="m-0 text-[17px] font-bold text-white">Diagnostic swarm</h2>
          <span className="text-[12px] text-muted-2">OpenSwarm · Gemini vision · {run?.agents.length ?? 7} agents</span>
        </div>
        <span className="inline-flex items-center gap-[6px] whitespace-nowrap rounded-full bg-teal px-[10px] py-[5px] text-[12px] font-semibold text-white">
          <span className={`h-[7px] w-[7px] rounded-full bg-cyan-pale ${running ? "live-dot" : ""}`} />
          {pill}
        </span>
      </div>
      <div className="flex flex-col">
        {run?.agents.map((a) => {
          const b = BADGE[a.status] ?? BADGE.done;
          return (
            <div key={a.id} className="flex gap-3 border-b border-navy-line px-5 py-[14px]">
              <div
                className={`mt-[5px] h-[10px] w-[10px] flex-none rounded-full ${a.status === "running" ? "live-dot" : ""}`}
                style={{ background: b.dot, boxShadow: "0 0 0 4px rgba(255,255,255,0.06)" }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-[10px]">
                  <span className="text-[14px] font-bold text-white">{a.name}</span>
                  <span className="whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold" style={{ background: b.bg, color: b.fg }}>
                    {a.badge}
                  </span>
                </div>
                <div className="text-[12px] text-muted-2">{a.scope}</div>
                <div className="text-[13px] leading-[1.5]">{a.result || (a.log.at(-1)?.text ?? "")}</div>
              </div>
            </div>
          );
        })}
      </div>
      {run && !running && typeof run.summary.note === "string" ? (
        <div className="bg-navy-2 px-5 py-4 text-[13px] leading-[1.5]">{run.summary.note}</div>
      ) : null}
    </aside>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { btnPrimary, btnSecondary, Card } from "@/components/ui";

type PatientOpt = { id: string; name: string };
type OcrField = { value: string; confidence: number; confirmed: boolean };
const FIELD_LABELS: Record<string, string> = { name: "Name", dob: "Date of birth", memberId: "Member ID", groupNumber: "Group number", carrier: "Carrier" };
const FILE_TYPES = [
  ["pano", "Panoramic X-ray"],
  ["bitewing", "Bitewing X-ray"],
  ["pa", "Periapical X-ray"],
  ["cbct", "CBCT slice"],
  ["intraoral", "Intraoral photo"],
  ["insurance_card", "Insurance card"],
] as const;

const input = "min-h-[44px] w-full rounded-[10px] border border-btn-border bg-white px-3 text-[14px] text-ink";

export function IntakeView({ patients, initialPatient }: { patients: PatientOpt[]; initialPatient?: string }) {
  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-col gap-5" style={{ flex: "1 1 360px" }}>
        <AddPatient />
        <CsvImport />
      </div>
      <div className="flex min-w-0 flex-col gap-5" style={{ flex: "999 1 520px" }}>
        <DropZone patients={patients} initialPatient={initialPatient} />
      </div>
    </div>
  );
}

function AddPatient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/intake/patient", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: f.get("name"),
        dob: f.get("dob"),
        email: f.get("email"),
        allergies: f.get("allergies"),
        consents: { treatment: f.get("c_treatment") === "on", ai_analysis: f.get("c_ai") === "on", marketing_email: f.get("c_email") === "on" },
      }),
    });
    const b = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(b.error ?? "Could not add the patient.");
    router.push(`/intake?patient=${b.id}&added=1`);
    router.refresh();
  }
  return (
    <Card className="flex flex-col gap-4 px-5 py-[18px]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-p3-tint">
          <Icon name="upload" size={20} color="#1A56DB" />
        </div>
        <div className="flex flex-col">
          <h2 className="m-0 text-[16px] font-bold">Add a patient</h2>
          <span className="text-[13px] text-muted">One patient at a time</span>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3 text-[13px]">
        <label className="flex flex-col gap-1 font-semibold">
          Name
          <input name="name" required className={input} autoComplete="off" />
        </label>
        <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
          <label className="flex flex-col gap-1 font-semibold">
            Date of birth
            <input name="dob" type="date" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-semibold">
            Email
            <input name="email" type="email" className={input} autoComplete="off" />
          </label>
        </div>
        <label className="flex flex-col gap-1 font-semibold">
          Allergies <span className="font-normal text-muted">comma-separated</span>
          <input name="allergies" className={input} />
        </label>
        <fieldset className="m-0 flex flex-col gap-2 rounded-[12px] border border-border-soft bg-subtle p-3">
          <legend className="px-1 font-mono text-[11px] tracking-[0.1em] text-muted">CONSENT (GDPR)</legend>
          {[
            ["c_treatment", "Treatment", true],
            ["c_ai", "AI analysis of images", true],
            ["c_email", "Aftercare and recall emails", false],
          ].map(([n, l, d]) => (
            <label key={n as string} className="flex min-h-[32px] items-center gap-2 text-[14px]">
              <input type="checkbox" name={n as string} defaultChecked={d as boolean} className="h-4 w-4 accent-teal" />
              {l}
            </label>
          ))}
        </fieldset>
        {err ? <span role="alert" className="font-semibold text-p1-pill">{err}</span> : null}
        <button className={`${btnPrimary} px-4`} disabled={busy}>
          {busy ? "Adding…" : "Add patient"}
        </button>
      </form>
    </Card>
  );
}

function CsvImport() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function upload(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/schedule/import", { method: "POST", body: fd });
    const b = await res.json();
    if (ref.current) ref.current.value = "";
    setMsg(res.ok ? `Imported ${b.imported} · placed ${b.placed} · ${b.blocked} need input` : b.error ?? "Import failed.");
    router.refresh();
  }
  return (
    <Card className="flex flex-col gap-3 px-5 py-[18px]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-p3-tint">
          <Icon name="document" size={20} color="#1A56DB" />
        </div>
        <div className="flex flex-col">
          <h2 className="m-0 text-[16px] font-bold">Import a whole day</h2>
          <span className="text-[13px] text-muted">CSV export from your practice software</span>
        </div>
      </div>
      <code className="block overflow-x-auto rounded-[8px] bg-subtle px-3 py-2 font-mono text-[12px] text-ink-2">
        patient_id,name,procedure_code,duration_min,priority,earliest,latest
      </code>
      <input ref={ref} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <div className="flex flex-wrap items-center gap-2">
        <button className={`${btnSecondary} px-4`} onClick={() => ref.current?.click()}>
          Choose CSV
        </button>
        {msg ? (
          <span role="status" className="text-[13px] font-semibold text-teal-dark">
            {msg} · <Link href="/schedule">Open schedule</Link>
          </span>
        ) : null}
      </div>
    </Card>
  );
}

type Queued = { file: File; type: string; state: "ready" | "uploading" | "done" | "error"; note?: string };

function DropZone({ patients, initialPatient }: { patients: PatientOpt[]; initialPatient?: string }) {
  const router = useRouter();
  const [patientId, setPatientId] = useState(initialPatient ?? patients[0]?.id ?? "");
  const [files, setFiles] = useState<Queued[]>([]);
  const [over, setOver] = useState(false);
  const [ocr, setOcr] = useState<{ id: string; fields: Record<string, OcrField>; low: string[] } | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const guess = (f: File) => (/card|insur/i.test(f.name) ? "insurance_card" : /bite|bw/i.test(f.name) ? "bitewing" : /photo|intra/i.test(f.name) ? "intraoral" : "pano");
  const add = (list: FileList | null) => list && setFiles((q) => [...q, ...Array.from(list).map((file) => ({ file, type: guess(file), state: "ready" as const }))]);

  async function uploadAll() {
    for (let i = 0; i < files.length; i++) {
      const q = files[i];
      if (q.state === "done") continue;
      setFiles((s) => s.map((x, j) => (j === i ? { ...x, state: "uploading" } : x)));
      const fd = new FormData();
      fd.set("file", q.file);
      fd.set("patientId", patientId);
      fd.set("type", q.type);
      const url = q.type === "insurance_card" ? "/api/intake/card-ocr" : `/api/patients/${patientId}/studies`;
      const res = await fetch(url, { method: "POST", body: fd });
      const b = await res.json();
      setFiles((s) => s.map((x, j) => (j === i ? { ...x, state: res.ok ? "done" : "error", note: res.ok ? undefined : b.error } : x)));
      if (res.ok && q.type === "insurance_card") setOcr({ id: b.id, fields: b.fields, low: b.lowConfidence });
    }
    router.refresh();
  }

  return (
    <>
      <Card className="flex flex-col gap-4 px-5 py-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-teal-tint">
              <Icon name="scan" size={20} color="#0B7285" />
            </div>
            <div className="flex flex-col">
              <h2 className="m-0 text-[16px] font-bold">Drop in files</h2>
              <span className="text-[13px] text-muted">X-rays, intraoral photos, insurance cards</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            Patient
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className={`${input} w-auto`}>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => pick.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            add(e.dataTransfer.files);
          }}
          className={`flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed text-[14px] transition-colors ${
            over ? "border-teal bg-teal-tint text-teal-dark" : "border-btn-border bg-subtle text-ink-2 hover:border-teal"
          }`}
        >
          <Icon name="upload" size={28} color="#0B7285" />
          <span className="font-semibold">Drop files here or click to choose</span>
          <span className="text-[12px] text-muted">PNG, JPEG or WebP · encrypted at rest</span>
        </button>
        <input ref={pick} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => add(e.target.files)} />
        {files.length ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {files.map((q, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border-soft px-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate font-semibold">{q.file.name}</span>
                <select
                  aria-label={`Type of ${q.file.name}`}
                  value={q.type}
                  disabled={q.state !== "ready"}
                  onChange={(e) => setFiles((s) => s.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
                  className="min-h-[36px] rounded-[8px] border border-btn-border bg-white px-2"
                >
                  {FILE_TYPES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <span className={`font-semibold ${q.state === "error" ? "text-p1-pill" : q.state === "done" ? "text-teal-dark" : "text-muted"}`}>
                  {q.state === "ready" ? "Ready" : q.state === "uploading" ? "Uploading…" : q.state === "done" ? "Saved" : q.note ?? "Failed"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button className={`${btnPrimary} px-4`} onClick={uploadAll} disabled={!files.some((f) => f.state === "ready") || !patientId}>
            Upload {files.filter((f) => f.state === "ready").length || ""} file(s)
          </button>
          {files.some((f) => f.state === "done" && f.type !== "insurance_card") ? (
            <Link href={`/diagnostics/${patientId}`} className={`${btnSecondary} px-4`}>
              Run the X-ray swarm →
            </Link>
          ) : null}
        </div>
      </Card>
      {ocr ? <OcrReview scan={ocr} onDone={() => setOcr(null)} patientId={patientId} /> : null}
    </>
  );
}

function OcrReview({ scan, onDone, patientId }: { scan: { id: string; fields: Record<string, OcrField>; low: string[] }; onDone: () => void; patientId: string }) {
  const router = useRouter();
  const [values, setValues] = useState(Object.fromEntries(Object.entries(scan.fields).map(([k, v]) => [k, v.value])));
  const [msg, setMsg] = useState<string | null>(null);
  async function confirm() {
    const res = await fetch(`/api/intake/card-ocr/${scan.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ values }) });
    const b = await res.json();
    if (!res.ok) return setMsg(b.error ?? "Could not save.");
    setMsg("Saved to the record.");
    router.refresh();
    setTimeout(onDone, 1500);
  }
  return (
    <Card className="rise flex flex-col gap-4 px-5 py-[18px]" style={{ borderColor: scan.low.length ? "#F3B48F" : undefined }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[16px] font-bold">Insurance card: check {scan.low.length ? `${scan.low.length} field${scan.low.length > 1 ? "s" : ""}` : "and confirm"}</h2>
        <span className="text-[12px] text-muted">OCR + Gemini · fields under 80% confidence need a look</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {Object.entries(scan.fields).map(([k, f]) => {
          const low = scan.low.includes(k);
          return (
            <label key={k} className="flex flex-col gap-1 text-[13px] font-semibold">
              <span className="flex items-center justify-between">
                {FIELD_LABELS[k] ?? k}
                <span className={`font-mono text-[11px] ${low ? "text-p1-pill" : "text-muted"}`}>
                  {low ? "check · " : ""}
                  {Math.round(f.confidence * 100)}%
                </span>
              </span>
              <input
                value={values[k] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                className={input}
                style={low ? { borderColor: "#F3B48F", background: "#FDEDE3" } : undefined}
              />
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={`${btnPrimary} px-4`} onClick={confirm}>
          Confirm card
        </button>
        <Link href={`/insurance/${patientId}`} className={`${btnSecondary} px-4`}>
          Run the insurance swarm →
        </Link>
        {msg ? <span role="status" className="text-[13px] font-semibold text-teal-dark">{msg}</span> : null}
      </div>
    </Card>
  );
}

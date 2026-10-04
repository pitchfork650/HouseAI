"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, btnSecondary } from "@/components/ui";

export function ScheduleActions({ date }: { date: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function autofill() {
    setBusy("fill");
    const res = await fetch("/api/schedule/autofill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, scope: "week" }) });
    const b = await res.json();
    setBusy(null);
    setMsg(res.ok ? `Placed ${b.placed} · ${b.blocked} still need input` : b.error ?? "Auto-fill failed.");
    router.refresh();
  }

  async function upload(file: File) {
    setBusy("import");
    const fd = new FormData();
    fd.set("file", file);
    fd.set("date", date);
    const res = await fetch("/api/schedule/import", { method: "POST", body: fd });
    const b = await res.json();
    setBusy(null);
    if (input.current) input.current.value = "";
    setMsg(res.ok ? `Imported ${b.imported} · placed ${b.placed} · ${b.blocked} need input${b.errors?.length ? ` · ${b.errors.length} row error(s)` : ""}` : b.error ?? "Import failed.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-[10px]">
      {msg ? <span role="status" className="text-[13px] font-semibold text-teal-dark">{msg}</span> : null}
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button className={`${btnSecondary} px-4`} onClick={() => input.current?.click()} disabled={busy !== null} title="CSV columns: patient_id, name, procedure_code, duration_min, priority, earliest, latest">
        {busy === "import" ? "Importing…" : "Import CSV / Eaglesoft"}
      </button>
      <button className={`${btnPrimary} px-[18px]`} onClick={autofill} disabled={busy !== null}>
        {busy === "fill" ? "Filling…" : "Auto-fill week"}
      </button>
    </div>
  );
}

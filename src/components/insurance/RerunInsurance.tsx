"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { btnSecondary } from "@/components/ui";

/** Starts a new insurance swarm run and refreshes while lanes are still working. */
export function RerunInsurance({ patientId, running }: { patientId: string; running: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 1000);
    return () => clearInterval(t);
  }, [running, router]);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/insurance/${patientId}/run`, { method: "POST" });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) setError(body.error ?? "Could not start the swarm.");
    router.refresh();
  }

  return (
    <>
      <button className={`${btnSecondary} px-4`} onClick={run} disabled={busy || running}>
        {busy || running ? "Checking…" : "Re-check insurance"}
      </button>
      {error ? <span role="alert" className="self-center text-[13px] font-semibold text-p1-pill">{error}</span> : null}
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, btnSecondary } from "@/components/ui";

export function FollowUpActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(action: "send-test" | "approve") {
    setBusy(action);
    const res = await fetch(`/api/follow-ups/${id}/${action}`, { method: "POST" });
    const body = await res.json();
    setBusy(null);
    setMsg(res.ok ? (action === "approve" ? "Approved. It will send at the scheduled time." : "Test sent to the clinic inbox.") : body.error ?? "Something went wrong.");
    router.refresh();
  }

  const approved = status !== "draft";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {msg ? <span role="status" className="text-[13px] font-semibold text-teal-dark">{msg}</span> : null}
      <button className={`${btnSecondary} px-4`} onClick={() => act("send-test")} disabled={busy !== null}>
        Send test
      </button>
      <button className={`${btnPrimary} px-4`} onClick={() => act("approve")} disabled={busy !== null || approved}>
        {approved ? (status === "sent" ? "Sent" : "Approved") : "Approve and schedule"}
      </button>
    </div>
  );
}

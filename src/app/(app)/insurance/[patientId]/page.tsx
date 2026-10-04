import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { hhmm } from "@/lib/clock";
import { latestRunId, loadRun, type AgentView } from "@/lib/views";
import { patientAmount } from "@/lib/swarm/insurance/cost";
import { Icon, type IconName } from "@/components/icons";
import { Card, Chip, PatientHeader } from "@/components/ui";
import { RerunInsurance } from "@/components/insurance/RerunInsurance";

const BADGE: Record<string, [string, string]> = {
  running: ["#E8EFFC", "#1E3F9A"],
  queued: ["#E8EFFC", "#1E3F9A"],
  done: ["#E3F4F6", "#075563"],
  verified: ["#E3F4F6", "#075563"],
  submitted: ["#E3F4F6", "#075563"],
  retry: ["#FDEDE3", "#9A3412"],
  failed: ["#FDEDE3", "#9A3412"],
};

function laneLook(a: AgentView): { tile: string; icon: IconName; iconColor: string; dot: string; failing: boolean } {
  const failing = a.status === "retry" || a.status === "failed";
  if (a.name === "Coordinator") return { tile: "#0B1F3A", icon: "swarm", iconColor: "#7DD3E0", dot: "#1A56DB", failing };
  if (failing) return { tile: "#FDEDE3", icon: "warning", iconColor: "#C2410C", dot: "#C2410C", failing };
  const icon: IconName = a.name === "Copay Chaser" ? "dollar" : a.name === "Pre-approval Agent" ? "document" : "shieldCheck";
  return { tile: "#E3F4F6", icon, iconColor: "#0B7285", dot: "#0B7285", failing };
}

function Lane({ a }: { a: AgentView }) {
  const look = laneLook(a);
  const [bg, fg] = BADGE[a.status] ?? BADGE.running;
  return (
    <div
      className="flex flex-col gap-[14px] rounded-[16px] bg-white px-5 py-[18px]"
      style={{
        border: look.failing ? "2px solid #F3B48F" : "1px solid #D9E2EC",
        boxShadow: "0 1px 2px rgba(11,31,58,0.05), 0 8px 24px rgba(11,31,58,0.04)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px]" style={{ background: look.tile }}>
          <Icon name={look.icon} size={20} color={look.iconColor} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-bold">{a.name}</span>
          <span className="text-[12px] text-muted">{a.scope}</span>
        </div>
        <span className="whitespace-nowrap rounded-full px-[9px] py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>
          {a.badge}
        </span>
      </div>
      <div className="flex flex-col pl-[6px]">
        {a.log.length === 0 ? <span className="text-[13px] text-muted">Waiting to start…</span> : null}
        {a.log.map((l, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center self-stretch">
              <span className={`mt-1 h-[10px] w-[10px] flex-none rounded-full ${a.status === "running" && i === a.log.length - 1 ? "live-dot" : ""}`} style={{ background: look.dot }} />
              <span className="w-[2px] flex-1 bg-border-soft" />
            </div>
            <div className="flex gap-[10px] pb-[10px] text-[13px] leading-[1.4]">
              <span className="font-mono text-[12px] text-muted">{hhmm(l.t)}</span>
              <span>{l.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function InsurancePage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      policies: true,
      treatmentItems: { where: { status: { in: ["planned", "scheduled"] } } },
      documents: { where: { kind: "insurance_card" }, orderBy: { scannedAt: "desc" }, take: 1 },
    },
  });
  if (!patient) notFound();
  const runId = await latestRunId(patientId, "insurance");
  const run = runId ? await loadRun(runId) : null;
  const estimate = runId ? await prisma.costEstimate.findFirst({ where: { runId }, orderBy: { createdAt: "desc" } }) : null;

  const lanes = run?.agents ?? [];
  const retrying = lanes.filter((a) => a.status === "retry" || a.status === "failed").length;
  const inProgress = lanes.some((a) => a.status === "running" && a.name !== "Coordinator") || lanes.some((a) => a.status === "queued");
  const scan = patient.documents[0];
  const sub = [patient.id, patient.insuranceNote, scan ? `card scanned ${hhmm(scan.scannedAt)}` : null].filter(Boolean).join(" · ");
  const chips = [
    ...(patient.policies.length > 1 ? ["Dual coverage"] : []),
    ...patient.treatmentItems.filter((t) => t.status === "planned").map((t) => `${t.title} planned`),
  ];
  const primary = patient.policies.find((p) => p.rank === "primary");
  const secondary = patient.policies.find((p) => p.rank === "secondary");
  const pillText = !run
    ? "OpenSwarm · not run yet"
    : `OpenSwarm · ${lanes.length} agents · ${inProgress ? "running" : retrying ? `${retrying} retrying` : "all done"}`;

  return (
    <>
      <PatientHeader
        initials={patient.initials}
        name={patient.name}
        sub={sub}
        chips={chips.map((c) => <Chip key={c}>{c}</Chip>)}
        right={
          <>
            <span className="inline-flex items-center gap-2 self-center rounded-full bg-navy px-[14px] py-2 text-[13px] font-bold text-white">
              <span className={`h-2 w-2 rounded-full bg-cyan-2 ${inProgress ? "live-dot" : ""}`} />
              {pillText}
            </span>
          </>
        }
      />

      {run ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))" }}>
          {lanes.map((a) => (
            <Lane key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <Card className="flex flex-wrap items-center gap-3 px-5 py-4 text-[14px] text-muted">
          No insurance check yet.
          <RerunInsurance patientId={patient.id} running={false} />
        </Card>
      )}

      {estimate ? (
        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-0 flex-col gap-4 rounded-[16px] bg-navy px-6 py-[22px] text-on-navy shadow-navy" style={{ flex: "2 1 520px" }}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] tracking-[0.1em] text-cyan">{estimate.label} · COST SPLIT (ESTIMATE)</span>
                <span className="text-[34px] font-extrabold text-white">
                  {patientAmount(estimate.fee, { primary: estimate.primaryShare, secondary: estimate.secondaryShare, patient: estimate.patientShare })}{" "}
                  <span className="text-[15px] font-medium text-muted-2">patient pays</span>
                </span>
              </div>
              {estimate.secondaryStatus === "pending" && secondary ? (
                <span className="text-[12px] text-muted-2">Updates when {secondary.carrier} responds</span>
              ) : null}
            </div>
            <div className="flex h-[14px] gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`Primary ${Math.round(estimate.primaryShare * 100)}%, secondary ${Math.round(estimate.secondaryShare * 100)}%, patient ${Math.round(estimate.patientShare * 100)}%`}>
              {estimate.primaryShare > 0 ? <div style={{ flex: estimate.primaryShare, background: "#38BDCF" }} /> : null}
              {estimate.secondaryShare > 0 ? (
                <div
                  style={{
                    flex: estimate.secondaryShare,
                    background: estimate.secondaryStatus === "pending" ? "repeating-linear-gradient(45deg, #1E3E66 0, #1E3E66 5px, #2A5285 5px, #2A5285 10px)" : "#2A5285",
                  }}
                />
              ) : null}
              {estimate.patientShare > 0 ? <div style={{ flex: estimate.patientShare, background: "#FFFFFF" }} /> : null}
            </div>
            <div className="flex flex-wrap gap-5 text-[13px]">
              {primary ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-[10px] w-[10px] rounded-[3px] bg-cyan-2" />
                  {primary.carrier} (primary) · {estimate.primaryStatus}
                </span>
              ) : null}
              {secondary ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-[10px] w-[10px] rounded-[3px]" style={{ background: "#2A5285" }} />
                  {secondary.carrier} (secondary) · {estimate.secondaryStatus}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-2">
                <span className="h-[10px] w-[10px] rounded-[3px] bg-white" />
                Patient
              </span>
            </div>
          </div>
          <Card className="flex min-w-0 flex-col gap-[10px] px-[22px] py-5 text-[14px] leading-[1.55] text-ink-2" style={{ flex: "1 1 300px" }}>
            <div className="flex items-center gap-[10px] font-bold text-ink">
              <Icon name="swarm" size={20} color="#0B7285" />
              Why a swarm and not a script
            </div>
            <span>{String(run?.summary.explainer ?? "")}</span>
            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              <RerunInsurance patientId={patient.id} running={inProgress} />
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

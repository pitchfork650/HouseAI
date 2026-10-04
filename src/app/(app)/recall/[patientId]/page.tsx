import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { recallForPatient, type Change } from "@/lib/recall";
import { Icon } from "@/components/icons";
import { btnSecondary, Card, Chip, PatientHeader, PriorityPill } from "@/components/ui";

const CHANGE: Record<Change, { label: string; bg: string; fg: string }> = {
  new: { label: "New", bg: "#FDEDE3", fg: "#9A3412" },
  progressed: { label: "Progressed", bg: "#FEF3C7", fg: "#92400E" },
  improved: { label: "Improved", bg: "#E3F4F6", fg: "#075563" },
  unchanged: { label: "Unchanged", bg: "#EDF1F5", fg: "#3A4A60" },
  not_seen: { label: "Not seen now", bg: "#E8EFFC", fg: "#1E3F9A" },
};

export default async function RecallPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) notFound();
  const recall = await recallForPatient(patientId);
  const counts = recall ? (Object.keys(CHANGE) as Change[]).map((c) => [c, recall.rows.filter((r) => r.change === c).length] as const).filter(([, n]) => n) : [];

  return (
    <>
      <PatientHeader
        initials={patient.initials}
        name={patient.name}
        sub={[patient.id, patient.ageYears != null ? `${patient.ageYears} Y` : null].filter(Boolean).join(" · ")}
        chips={recall ? <Chip>{`Recall X-rays ${recall.now.date} vs ${recall.before.date}`}</Chip> : null}
        right={
          <Link href={`/diagnostics/${patientId}`} className={`${btnSecondary} px-4`}>
            Open diagnostics
          </Link>
        }
      />
      {!recall ? (
        <Card className="px-5 py-4 text-[14px] text-muted">No earlier swarm run to compare with yet. After the next recall X-ray, the swarm compares it against this one.</Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            {counts.map(([c, n]) => (
              <div key={c} className="flex items-center gap-3 rounded-[14px] border border-border bg-white px-4 py-3 shadow-card">
                <span className="text-[24px] font-extrabold leading-none">{n}</span>
                <span className="rounded-full px-[10px] py-1 text-[12px] font-bold" style={{ background: CHANGE[c].bg, color: CHANGE[c].fg }}>
                  {CHANGE[c].label}
                </span>
              </div>
            ))}
          </div>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-5 py-4">
              <h2 className="m-0 flex items-center gap-2 text-[16px] font-bold">
                <Icon name="loop" size={18} color="#0B7285" />
                What changed since the last recall
              </h2>
              <span className="text-[13px] text-muted">
                {recall.before.date} → {recall.now.date} · tooth by tooth
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[14px]">
                <thead>
                  <tr className="bg-subtle text-left text-[11px] tracking-[0.08em] text-muted">
                    <th className="px-5 py-[10px] font-semibold">TOOTH</th>
                    <th className="px-3 py-[10px] font-semibold">BEFORE · {recall.before.date}</th>
                    <th className="px-3 py-[10px] font-semibold">NOW · {recall.now.date}</th>
                    <th className="px-5 py-[10px] font-semibold">CHANGE</th>
                  </tr>
                </thead>
                <tbody>
                  {recall.rows.map((r) => (
                    <tr key={r.tooth} className="border-t border-row-line">
                      <td className="px-5 py-3 font-mono font-medium">#{r.tooth}</td>
                      <td className="px-3 py-3 text-ink-2">{r.before ? r.before.text : <span className="text-muted">Nothing flagged</span>}</td>
                      <td className="px-3 py-3">
                        {r.now ? (
                          <span className="flex flex-wrap items-center gap-2">
                            {r.now.text} <PriorityPill p={r.now.priority} size="sm" />
                          </span>
                        ) : (
                          <span className="text-muted">Not flagged on the new X-ray</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="whitespace-nowrap rounded-full px-[10px] py-1 text-[12px] font-bold" style={{ background: CHANGE[r.change].bg, color: CHANGE[r.change].fg }}>
                          {CHANGE[r.change].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      <p className="m-0 text-[13px] text-muted">Decision support only. A change flagged here is a prompt to look again; the dentist confirms what changed.</p>
    </>
  );
}

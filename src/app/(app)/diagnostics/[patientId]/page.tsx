import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { latestRunId, loadRun } from "@/lib/views";
import Link from "next/link";
import { DiagnosticsView, type TruthView } from "@/components/diagnostics/DiagnosticsView";
import { scoreFindings, truthOverlays } from "@/lib/xray-score";

export default async function DiagnosticsPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, include: { studies: { orderBy: { takenAt: "desc" } } } });
  if (!patient) notFound();
  const runId = await latestRunId(patientId, "diagnostic");
  const run = runId ? await loadRun(runId) : null;

  const runStudyId = runId ? (await prisma.swarmRun.findUnique({ where: { id: runId }, select: { studyId: true } }))?.studyId : null;
  const runStudy = patient.studies.find((s) => s.id === runStudyId);
  const study = runStudy ?? patient.studies.find((s) => s.type === "pano") ?? patient.studies[0] ?? null;
  // "Last X-rays": newest study taken before the current visit's images.
  const visitDay = study?.takenAt.toISOString().slice(0, 10);
  const previous = patient.studies.find((s) => s.takenAt.toISOString().slice(0, 10) !== visitDay && s.takenAt < (study?.takenAt ?? new Date()));

  // Public-dataset X-rays carry expert labels: draw them and score the latest run against them.
  const truth: TruthView =
    study?.labels && study.width && study.height
      ? {
          source: study.source ?? "",
          overlays: truthOverlays(study),
          comparison: run && run.status !== "running" && runStudyId === study.id ? scoreFindings(run.findings, study) : null,
          model: run?.agents.find((a) => a.model && a.model !== "mock")?.model ?? (run ? "mock" : null),
        }
      : null;
  const datasetPatients = await prisma.patient.findMany({ where: { id: { startsWith: "BW-" } }, select: { id: true, name: true }, orderBy: { id: "asc" } });

  const chips = [patient.premedicationRequired ? "Premedication required" : "No premedication needed"];
  if (previous) chips.push(`Last X-rays ${previous.takenAt.toISOString().slice(0, 7)}`);
  const sub = [patient.id, patient.ageYears != null ? `${patient.ageYears} Y` : null, patient.dob ? `DOB ${patient.dob}` : null].filter(Boolean).join(" · ");

  return (
    <>
      {datasetPatients.length ? (
        <nav aria-label="Dataset X-rays" className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-mono text-[11px] tracking-[0.1em] text-muted">REAL BITEWINGS</span>
          {[{ id: "P-1042", name: "Sample patient" }, ...datasetPatients].map((p) => (
            <Link
              key={p.id}
              href={`/diagnostics/${p.id}`}
              aria-current={p.id === patient.id ? "page" : undefined}
              className={`rounded-full border px-3 py-1 no-underline ${p.id === patient.id ? "border-teal bg-teal text-white hover:text-white" : "border-border bg-white text-ink-2 hover:border-teal hover:text-ink"}`}
            >
              {p.name}
            </Link>
          ))}
        </nav>
      ) : null}
      <DiagnosticsView
        truth={truth}
        patientId={patient.id}
        header={{ initials: patient.initials, name: patient.name, sub, allergies: patient.allergies as string[], chips }}
        run={run}
        study={study ? { id: study.id, type: study.type, takenAt: study.takenAt.toISOString(), synthetic: !study.fileUrl?.startsWith("storage:"), width: study.width, height: study.height } : null}
      />
      <p className="m-0 text-[13px] text-muted">
        Decision support only. The swarm suggests and explains findings, and the dentist confirms each one before it reaches the chart.
      </p>
    </>
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { latestRunId, loadRun } from "@/lib/views";
import Link from "next/link";
import { DiagnosticsView, type TruthView } from "@/components/diagnostics/DiagnosticsView";
import { compareToGroundTruth, LABEL_TEXT, type GroundTruth } from "@/lib/ground-truth";
import { pixelBoxToOverlay } from "@/lib/xray-frame";

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
  const labels = (study?.labels as GroundTruth[] | null) ?? null;
  const size = study?.width && study.height ? { width: study.width, height: study.height } : null;
  const truth: TruthView =
    labels && size
      ? {
          source: study?.source ?? "",
          overlays: labels.map((l) => pixelBoxToOverlay(l.box, `#${l.tooth} ${LABEL_TEXT[l.label]}`, size)),
          comparison: run && run.status !== "running" && runStudyId === study?.id ? compareToGroundTruth(run.findings, labels) : null,
          model: run?.agents.find((a) => a.model && a.model !== "mock")?.model ?? (run ? "mock" : null),
        }
      : null;
  const datasetPatients = await prisma.patient.findMany({ where: { id: { startsWith: "DX-" } }, select: { id: true, name: true }, orderBy: { id: "asc" } });

  const chips = [patient.premedicationRequired ? "Premedication required" : "No premedication needed"];
  if (previous) chips.push(`Last X-rays ${previous.takenAt.toISOString().slice(0, 7)}`);
  const sub = [patient.id, patient.ageYears != null ? `${patient.ageYears} Y` : null, patient.dob ? `DOB ${patient.dob}` : null].filter(Boolean).join(" · ");

  return (
    <>
      {datasetPatients.length ? (
        <nav aria-label="Dataset X-rays" className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-mono text-[11px] tracking-[0.1em] text-muted">REAL X-RAYS · DENTEX</span>
          {[{ id: "P-1042", name: "Sample patient" }, ...datasetPatients].map((p) => (
            <Link
              key={p.id}
              href={`/diagnostics/${p.id}`}
              aria-current={p.id === patient.id ? "page" : undefined}
              className={`rounded-full border px-3 py-1 no-underline ${p.id === patient.id ? "border-teal bg-teal text-white hover:text-white" : "border-border bg-white text-ink-2 hover:border-teal hover:text-ink"}`}
            >
              {p.name.replace("DENTEX ", "")}
            </Link>
          ))}
        </nav>
      ) : null}
      <DiagnosticsView
        truth={truth}
        patientId={patient.id}
        header={{ initials: patient.initials, name: patient.name, sub, allergies: patient.allergies as string[], chips }}
        run={run}
        study={study ? { id: study.id, type: study.type, takenAt: study.takenAt.toISOString(), synthetic: !study.fileUrl?.startsWith("storage:") } : null}
      />
      <p className="m-0 text-[13px] text-muted">
        Decision support only. The swarm suggests and explains findings, and the dentist confirms each one before it reaches the chart.
      </p>
    </>
  );
}

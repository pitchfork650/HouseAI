import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { latestRunId, loadRun } from "@/lib/views";
import { DiagnosticsView } from "@/components/diagnostics/DiagnosticsView";

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

  const chips = [patient.premedicationRequired ? "Premedication required" : "No premedication needed"];
  if (previous) chips.push(`Last X-rays ${previous.takenAt.toISOString().slice(0, 7)}`);
  const sub = [patient.id, patient.ageYears != null ? `${patient.ageYears} Y` : null, patient.dob ? `DOB ${patient.dob}` : null].filter(Boolean).join(" · ");

  return (
    <>
      <DiagnosticsView
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

import type { Prisma } from "@prisma/client";
import { prisma } from "../../db";
import { audit } from "../../audit";
import { assertMayUseModel } from "../../llm";
import { invokeAgent } from "../host";
import { loadPrompt } from "../../prompts";
import { readFile } from "../../storage";
import { registerAgents, runPhase, type AgentSpec } from "../coordinator";
import { PrismaRunStore } from "../prisma-store";
import { AGENT_ORDER, SKIP_PHRASES, SPECIALISTS, collectCandidates, skepticSpec, specialistSpec, verifierSpec, type DiagnosticInput, type ReviewInput } from "./agents";
import { mergeFindings, skipNote } from "./consensus";
import { mockConsensus } from "./mocks";
import { ConsensusOutputSchema, type SkepticOutput, type VerifierOutput } from "./schemas";

/** Load the images for the latest visit: every study taken on the same day as the newest one. */
async function loadVisitStudies(patientId: string) {
  const studies = await prisma.imagingStudy.findMany({ where: { patientId }, orderBy: { takenAt: "desc" } });
  if (!studies.length) return { primary: null, visit: [] as typeof studies };
  const day = studies[0].takenAt.toISOString().slice(0, 10);
  const visit = studies.filter((s) => s.takenAt.toISOString().slice(0, 10) === day);
  const primary = visit.find((s) => s.type === "pano") ?? visit[0];
  return { primary, visit };
}

/**
 * Start a diagnostic swarm run. Creates the run and its 7 agent rows, returns the
 * run id immediately, and executes the swarm in the background.
 */
export async function startDiagnosticRun(patientId: string, opts: { actor?: string; wait?: boolean } = {}): Promise<string> {
  const actor = opts.actor ?? "user:dentist";
  const patient = await prisma.patient.findUniqueOrThrow({ where: { id: patientId } });
  const consent = await prisma.consent.findFirst({ where: { patientId, purpose: "ai_analysis" }, orderBy: { timestamp: "desc" } });
  if (!consent?.granted) throw new Error("No AI-analysis consent on file for this patient.");

  const { primary, visit } = await loadVisitStudies(patientId);
  const run = await prisma.swarmRun.create({
    data: { kind: "diagnostic", patientId, studyId: primary?.id ?? null, status: "running", summary: {} },
  });
  await audit({ actor, action: "swarm.diagnostic.start", entity: "SwarmRun", entityId: run.id, inputs: { patientId, studies: visit.map((s) => s.id) } });

  const synthetic = visit.every((s) => !s.fileUrl || s.fileUrl.startsWith("synthetic:"));
  const studies: DiagnosticInput["studies"] = [];
  for (const s of visit) {
    if (s.fileUrl?.startsWith("storage:") && s.mimeType) studies.push({ type: s.type, image: { mimeType: s.mimeType, data: await readFile(s.fileUrl) } });
    else studies.push({ type: s.type });
  }
  if (!synthetic) assertMayUseModel(patient);

  // Minimum context only: images, age, numbering system. No name, DOB or contact details.
  const input: DiagnosticInput = { studies, context: { ageYears: patient.ageYears }, forceMock: synthetic };
  const store = new PrismaRunStore(run.id, { studies: visit.map((s) => s.id), ageYears: patient.ageYears });

  const specialistSpecs = SPECIALISTS.map(specialistSpec);
  const byName = new Map<string, AgentSpec<never, unknown>>([
    ...specialistSpecs.map((s) => [s.name, s as AgentSpec<never, unknown>] as const),
    ["Verifier", verifierSpec as AgentSpec<never, unknown>],
    ["Skeptic", skepticSpec as AgentSpec<never, unknown>],
  ]);
  const ordered = AGENT_ORDER.map((n) => byName.get(n)!);
  const ids = await registerAgents(store, ordered);
  const idOf = (name: string) => ids[AGENT_ORDER.indexOf(name)];

  const work = execute(run.id, input, store, specialistSpecs, idOf).catch(async (e) => {
    console.error("[swarm] diagnostic run failed", e);
    await prisma.swarmRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date(), summary: { error: String(e) } } });
  });
  if (opts.wait) await work;
  return run.id;
}

async function execute(
  runId: string,
  input: DiagnosticInput,
  store: PrismaRunStore,
  specialistSpecs: ReturnType<typeof specialistSpec>[],
  idOf: (name: string) => string,
) {
  // Phase 1: specialists read the images in parallel.
  const phase1 = await runPhase(store, specialistSpecs.map((s) => idOf(s.name)), specialistSpecs as AgentSpec<DiagnosticInput, unknown>[], input);
  const p1 = specialistSpecs.map((s, i) => ({ name: s.name, outcome: phase1[i] }));
  const candidates = collectCandidates(p1);

  // Phase 2: Verifier and Skeptic review every candidate in parallel.
  const review: ReviewInput = { ...input, candidates };
  const [vOut, sOut] = await runPhase(store, [idOf("Verifier"), idOf("Skeptic")], [verifierSpec, skepticSpec] as AgentSpec<ReviewInput, unknown>[], review);
  const verifier = vOut.status === "done" || vOut.status === "flag" ? (vOut.output as VerifierOutput) : null;
  const skeptic = sOut.status === "done" || sOut.status === "flag" ? (sOut.output as SkepticOutput) : null;

  // Merge: agreement + prioritizer rules, then the consensus call explains each finding.
  const rows = mergeFindings(candidates, verifier, skeptic);
  const prompt = loadPrompt("consensus");
  const consensus = await invokeAgent({
    name: "Consensus",
    slug: "consensus",
    version: prompt.version,
    prompt: prompt.text,
    runId,
    context: { rows: rows.map((r) => ({ key: r.key, condition: r.condition, teeth: r.teeth, agreement: r.agreement, challenged: r.challenged, nearNerveCanal: r.nearNerveCanal })) },
    schema: ConsensusOutputSchema,
    mock: () => mockConsensus(rows),
    forceMock: input.forceMock,
  });
  const text = new Map(consensus.data.rows.map((r) => [r.key, r.text]));

  await prisma.$transaction(
    rows.map((r, i) =>
      prisma.finding.create({
        data: {
          runId,
          order: i,
          teeth: r.teeth,
          condition: r.condition,
          text: text.get(r.key) ?? r.condition,
          reporter: r.reporter,
          agreement: r.agreement,
          cdtCode: r.cdtCode,
          suggested: r.suggested,
          durationMin: r.durationMin,
          visits: r.visits,
          priority: r.priority,
          prerequisite: r.prerequisite ?? null,
          overlay: r.overlay as unknown as Prisma.InputJsonValue,
          confidence: r.confidence,
        },
      }),
    ),
  );
  await audit({ actor: "Consensus", action: "swarm.diagnostic.consensus", entity: "SwarmRun", entityId: runId, inputs: rows, outputs: consensus.data, model: consensus.model, details: { promptVersion: prompt.version } });

  const agents = await prisma.agentRun.findMany({ where: { runId }, orderBy: { order: "asc" } });
  const reported = agents.filter((a) => a.status !== "skip" && a.status !== "failed").length;
  await prisma.swarmRun.update({
    where: { id: runId },
    data: {
      status: agents.some((a) => a.status === "failed") ? "partial" : "done",
      finishedAt: new Date(),
      summary: {
        reported,
        total: agents.length,
        note: skipNote(agents.map((a) => ({ name: a.name, status: a.status, skipPhrase: SKIP_PHRASES[a.name] }))),
        consensusModel: consensus.model,
      },
    },
  });
}

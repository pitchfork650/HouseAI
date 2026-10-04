import { prisma } from "../../db";
import { audit } from "../../audit";
import { now as clinicNow } from "../../clock";
import { registerAgents, runAgent, runPhase, type AgentOutcome, type AgentSpec } from "../coordinator";
import { PrismaRunStore } from "../prisma-store";
import { RealClock, type Clock } from "../clock";
import { adaptersFor, MockPhoneLine } from "./adapters";
import { copayLane, eligibilityLane, explainRun, preapprovalLane, type CopayOutput, type LaneInput, type PolicyRef } from "./lanes";
import { costSplit } from "./cost";

const COORDINATOR = { name: "Coordinator", scope: "Splits the job, merges results" };

type Opts = { clock?: Clock; background?: boolean; actor?: string };

/**
 * Insurance swarm: a coordinator plus one independent lane per job (eligibility
 * per insurer, copay chasing, pre-approval). A timeout or retry in one lane never
 * blocks the others; the coordinator merges whatever finished.
 */
export async function startInsuranceRun(patientId: string, opts: Opts = {}): Promise<string> {
  const clock = opts.clock ?? new RealClock(undefined, clinicNow);
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    include: { policies: true, treatmentItems: { where: { status: { in: ["planned", "scheduled"] } } }, studies: { orderBy: { takenAt: "desc" } } },
  });
  const run = await prisma.swarmRun.create({ data: { kind: "insurance", patientId, status: "running", summary: {}, startedAt: clock.now() } });
  await audit({ actor: opts.actor ?? "user:staff", action: "swarm.insurance.start", entity: "SwarmRun", entityId: run.id, inputs: { patientId } });

  const store = new PrismaRunStore(run.id, { patientId, policies: patient.policies.map((p) => p.id) });
  const policies: PolicyRef[] = patient.policies
    .sort((a, b) => (a.rank === "primary" ? -1 : 1) - (b.rank === "primary" ? -1 : 1))
    .map((p) => ({ id: p.id, carrier: p.carrier, planName: p.planName, rank: p.rank as PolicyRef["rank"], channel: "portal" }));
  const primary = policies.find((p) => p.rank === "primary") ?? policies[0];

  // The procedure needing pre-approval: the highest-value planned item (implants first).
  const procedure = patient.treatmentItems.find((t) => t.cdtCode === "D6010") ?? patient.treatmentItems[0];
  const codes = [...new Set(["D2740", ...patient.treatmentItems.map((t) => t.cdtCode)])];
  const studyTypes = (() => {
    if (!patient.studies.length) return [] as string[];
    const day = patient.studies[0].takenAt.toISOString().slice(0, 10);
    return patient.studies.filter((s) => s.takenAt.toISOString().slice(0, 10) === day).map((s) => s.type);
  })();
  const findingText = procedure?.findingId
    ? [(await prisma.finding.findUnique({ where: { id: procedure.findingId } }))?.text ?? ""].filter(Boolean)
    : [];

  const lanes: AgentSpec<LaneInput, unknown>[] = [
    ...policies.map((p) => {
      const a = adaptersFor(p.carrier);
      return eligibilityLane(p, a.primary, a.fallback) as AgentSpec<LaneInput, unknown>;
    }),
    ...(primary ? [copayLane(primary, adaptersFor(primary.carrier).primary, codes) as AgentSpec<LaneInput, unknown>] : []),
    ...(procedure && primary
      ? [preapprovalLane({ code: procedure.cdtCode, title: procedure.title, teeth: procedure.teeth as number[] }, findingText, studyTypes, adaptersFor(primary.carrier).primary) as AgentSpec<LaneInput, unknown>]
      : []),
  ];

  const [coordId] = await registerAgents(store, [{ ...COORDINATOR, run: async () => ({ status: "done", badge: "", result: "" }) }]);
  const ids = await registerAgents(store, lanes, 1);
  const input: LaneInput = { clock, forceMock: true };

  const work = execute(run.id, store, coordId, ids, lanes, input, policies, procedure?.cdtCode ?? null, procedure?.teeth as number[] | undefined).catch(async (e) => {
    console.error("[swarm] insurance run failed", e);
    await prisma.swarmRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date(), summary: { error: String(e) } } });
  });
  if (opts.background === false) await work;
  return run.id;
}

async function execute(
  runId: string,
  store: PrismaRunStore,
  coordId: string,
  ids: string[],
  lanes: AgentSpec<LaneInput, unknown>[],
  input: LaneInput,
  policies: PolicyRef[],
  procedureCode: string | null,
  teeth: number[] | undefined,
) {
  const clock = input.clock;
  const coordLog: { t: string; text: string }[] = [];
  const clog = async (text: string, at: Date) => {
    coordLog.push({ t: at.toISOString(), text });
    await store.update(coordId, { log: [...coordLog] });
  };
  await store.update(coordId, { status: "running", badge: "Running", startedAt: clock.now() });
  await clog(`Card OCR found ${policies.length} carrier${policies.length === 1 ? "" : "s"}`, clock.now());
  await clog(`Started ${lanes.length} agents`, clock.now());

  const outcomes = await runPhase(store, ids, lanes, input);
  await mergeAndFinish(runId, coordId, coordLog, lanes.map((l, i) => ({ id: ids[i], name: l.name, outcome: outcomes[i] })), policies, procedureCode, teeth, clock);
}

type LaneResult = { id: string; name: string; outcome: AgentOutcome };

async function mergeAndFinish(
  runId: string,
  coordId: string,
  coordLog: { t: string; text: string }[],
  lanes: LaneResult[],
  policies: PolicyRef[],
  procedureCode: string | null,
  teeth: number[] | undefined,
  clock: Clock,
) {
  const rows = await prisma.agentRun.findMany({ where: { runId, id: { in: lanes.map((l) => l.id) } } });
  const lastLog = Math.max(
    clock.now().getTime(),
    ...rows.filter((r) => r.status !== "retry").flatMap((r) => (r.log as { t: string }[]).map((l) => Date.parse(l.t))),
  );
  const mergedAt = clock instanceof RealClock ? clock.now() : new Date(lastLog + 120_000);

  const eligibility = lanes.filter((l) => l.name.startsWith("Eligibility"));
  const verifiedCarriers = eligibility.filter((l) => l.outcome.status === "verified").map((l) => l.name.replace("Eligibility · ", ""));
  const merged = coordLog.some((l) => l.text.startsWith("Merged")) ? [] : verifiedCarriers;
  if (merged.length) coordLog.push({ t: mergedAt.toISOString(), text: `Merged ${merged.join(" + ")} result` });

  const retrying = lanes.filter((l) => l.outcome.status === "retry" || l.outcome.status === "failed");
  await prisma.agentRun.update({
    where: { id: coordId },
    data: {
      status: retrying.length ? "running" : "done",
      badge: retrying.length ? "Running" : "Done",
      result: retrying.length ? `Waiting on ${retrying.length} lane(s)` : "All lanes merged",
      log: coordLog,
      finishedAt: retrying.length ? null : mergedAt,
    },
  });

  // Cost estimate from the coverage results and coordination of benefits.
  const run = await prisma.swarmRun.findUniqueOrThrow({ where: { id: runId } });
  const policyRows = await prisma.insurancePolicy.findMany({ where: { id: { in: policies.map((p) => p.id) } } });
  const copay = lanes.find((l) => l.name === "Copay Chaser")?.outcome.output as CopayOutput | undefined;
  const secondary = policyRows.find((p) => p.rank === "secondary");
  const secondaryLane = eligibility.find((l) => secondary && l.name.endsWith(secondary.carrier));
  const secondaryVerified = secondaryLane?.outcome.status === "verified";
  for (const p of policyRows) {
    const lane = eligibility.find((l) => l.name.endsWith(p.carrier));
    if (lane) await prisma.insurancePolicy.update({ where: { id: p.id }, data: { status: lane.outcome.status === "verified" ? "verified" : "pending" } });
  }
  if (procedureCode) {
    const pct = copay?.items.find((c) => c.code === procedureCode)?.pct ?? 0;
    const split = costSplit(pct, secondary ? secondary.secondaryShareOfRemainder ?? 0 : 0);
    await prisma.costEstimate.create({
      data: {
        patientId: run.patientId,
        runId,
        procedureCode,
        label: `${procedureLabel(procedureCode)}${teeth?.length ? " " + teeth.map((t) => `#${t}`).join(" ") : ""}`,
        fee: null,
        primaryShare: split.primary,
        secondaryShare: split.secondary,
        patientShare: split.patient,
        primaryStatus: verifiedCarriers.length ? "verified" : "pending",
        secondaryStatus: secondary ? (secondaryVerified ? "verified" : "pending") : "none",
      },
    });
  }

  const allLanes = lanes.map((l) => ({ name: l.name, status: l.outcome.status, carrier: l.name.startsWith("Eligibility") ? l.name.replace("Eligibility · ", "") : undefined }));
  await prisma.swarmRun.update({
    where: { id: runId },
    data: {
      status: retrying.length ? "partial" : "done",
      finishedAt: retrying.length ? null : mergedAt,
      summary: { explainer: explainRun(allLanes), retrying: retrying.length },
    },
  });
  await audit({ actor: "Coordinator", action: "swarm.insurance.merge", entity: "SwarmRun", entityId: runId, outputs: allLanes });
}

function procedureLabel(code: string): string {
  return ({ D6010: "IMPLANT", D2740: "CROWN", D3330: "ROOT CANAL" } as Record<string, string>)[code] ?? code;
}

/**
 * Scheduler hook: re-run any lane whose retry time has come (phone-line fallback),
 * then re-merge. Other lanes keep their results.
 */
export async function processDueLaneRetries(at: Date = clinicNow()): Promise<number> {
  const due = await prisma.agentRun.findMany({ where: { status: "retry", nextAttemptAt: { lte: at } }, include: { run: true } });
  for (const lane of due) {
    const policy = await prisma.insurancePolicy.findFirst({ where: { patientId: lane.run.patientId, carrier: lane.name.replace("Eligibility · ", "") } });
    if (!policy) continue;
    const ref: PolicyRef = { id: policy.id, carrier: policy.carrier, planName: policy.planName, rank: policy.rank as PolicyRef["rank"], channel: "phone" };
    const store = new PrismaRunStore(lane.runId, { patientId: lane.run.patientId, retryOf: lane.id });
    const prevLog = lane.log as { t: string; text: string }[];
    const clock = new RealClock(undefined, clinicNow);
    const outcome = await runAgent(store, lane.id, eligibilityLane(ref, new MockPhoneLine(14)), { clock, forceMock: true });
    const row = await prisma.agentRun.findUniqueOrThrow({ where: { id: lane.id } });
    await prisma.agentRun.update({ where: { id: lane.id }, data: { log: [...prevLog, ...(row.log as { t: string; text: string }[])], scope: `${policy.planName} · phone` } });

    const all = await prisma.agentRun.findMany({ where: { runId: lane.runId }, orderBy: { order: "asc" } });
    const coord = all.find((a) => a.name === "Coordinator")!;
    const lanes: LaneResult[] = all
      .filter((a) => a.name !== "Coordinator")
      .map((a) => ({ id: a.id, name: a.name, outcome: a.id === lane.id ? outcome : { status: a.status as AgentOutcome["status"], badge: a.badge, result: a.result, output: a.output ?? undefined } }));
    const policies = (await prisma.insurancePolicy.findMany({ where: { patientId: lane.run.patientId } })).map((p) => ({ id: p.id, carrier: p.carrier, planName: p.planName, rank: p.rank as PolicyRef["rank"], channel: "portal" }));
    const est = await prisma.costEstimate.findFirst({ where: { runId: lane.runId }, orderBy: { createdAt: "desc" } });
    const coordLog = (coord.log as { t: string; text: string }[]).concat(outcome.status === "verified" ? [{ t: clock.now().toISOString(), text: `Merged ${ref.carrier} result` }] : []);
    await mergeAndFinish(lane.runId, coord.id, coordLog, lanes, policies, est?.procedureCode ?? null, undefined, clock);
    if (est) {
      const newest = await prisma.costEstimate.findFirst({ where: { runId: lane.runId }, orderBy: { createdAt: "desc" } });
      if (newest) await prisma.costEstimate.update({ where: { id: newest.id }, data: { label: est.label } });
    }
  }
  return due.length;
}

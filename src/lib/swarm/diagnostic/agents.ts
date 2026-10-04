import type { ImagePart } from "../../llm";
import { agentSpecTimeoutMs, diagnosticHost, invokeAgent } from "../host";
import { loadPrompt } from "../../prompts";
import type { AgentOutcome, AgentSpec } from "../coordinator";
import { RULES, type Condition } from "../../rules/prioritize";
import { box2dToOverlay } from "../../xray-frame";
import {
  SkepticOutputSchema,
  SpecialistRawOutputSchema,
  VerifierOutputSchema,
  type Candidate,
  type SkepticOutput,
  type SpecialistOutput,
  type SpecialistRawOutput,
  type VerifierOutput,
} from "./schemas";
import { MOCK_SPECIALISTS, mockSkeptic, mockVerifier } from "./mocks";

export type StudyInput = { type: string; image?: ImagePart; width?: number; height?: number };

/** Data minimization: agents see only the images plus the minimum context. */
export type DiagnosticInput = {
  studies: StudyInput[];
  context: { ageYears: number | null };
  forceMock: boolean;
  runId?: string;
};

export type ReviewInput = DiagnosticInput & { candidates: Candidate[] };

type SpecialistDef = { name: string; slug: string; scope: string; needs: string[]; skipPhrase: string };

export const SPECIALISTS: SpecialistDef[] = [
  { name: "Caries Scout", slug: "caries-scout", scope: "Bitewings · cavities between teeth", needs: ["bitewing", "pano"], skipPhrase: "had no bitewing or panoramic to read" },
  { name: "Root-Tip Agent", slug: "root-tip", scope: "Panoramic · infection at root tips", needs: ["pano", "pa"], skipPhrase: "had no panoramic to read" },
  { name: "Third-Molar Agent", slug: "third-molar", scope: "Panoramic · wisdom teeth, nerve canal", needs: ["pano", "cbct"], skipPhrase: "had no panoramic to read" },
  { name: "Restoration Auditor", slug: "restoration-auditor", scope: "Crowns · fillings · root canals", needs: ["pano", "bitewing", "pa"], skipPhrase: "had no X-ray to read" },
  { name: "Shade Agent", slug: "shade", scope: "Intraoral photos · cosmetic", needs: ["intraoral"], skipPhrase: "had no intraoral photo to read" },
];

export const SKIP_PHRASES: Record<string, string> = Object.fromEntries(SPECIALISTS.map((s) => [s.name, s.skipPhrase]));

/** Display order of the 7 agents in the panel. */
export const AGENT_ORDER = ["Caries Scout", "Root-Tip Agent", "Third-Molar Agent", "Restoration Auditor", "Verifier", "Skeptic", "Shade Agent"];

const SKIP_REASONS: Record<string, string> = {
  "Shade Agent": "No intraoral photo uploaded. Nothing else was affected.",
};

function imagesFor(input: DiagnosticInput, needs: string[]) {
  return input.studies.filter((s) => needs.includes(s.type));
}

/** Map box_2d geometry (relative to the first image sent) into the 800×400 viewer frame. */
export function normalizeOverlays(out: SpecialistRawOutput, img: { width?: number; height?: number } | undefined): SpecialistOutput {
  return {
    ...out,
    findings: out.findings.map((f) => ({
      ...f,
      overlay: f.overlay.flatMap((o) => (o.kind !== "box2d" ? [o] : img?.width && img.height ? [box2dToOverlay(o.box_2d, o.label, { width: img.width, height: img.height })] : [])),
    })),
  };
}

function specialistBadge(out: SpecialistOutput): Pick<AgentOutcome, "status" | "badge"> {
  const urgent = out.findings.some((f) => RULES[f.condition as Condition].priority === "P1");
  if (urgent) return { status: "flag", badge: "Flagged" };
  if (!out.findings.length) return { status: "done", badge: "Nothing found" };
  return { status: "done", badge: `${out.findings.length} found` };
}

export function specialistSpec(def: SpecialistDef): AgentSpec<DiagnosticInput, SpecialistOutput> {
  return {
    name: def.name,
    scope: def.scope,
    get timeoutMs() { return agentSpecTimeoutMs(90_000); },
    retries: 1,
    skip: (input) => (imagesFor(input, def.needs).length ? null : SKIP_REASONS[def.name] ?? `No ${def.needs[0]} image uploaded. Nothing else was affected.`),
    async run(input, ctx) {
      const prompt = loadPrompt(def.slug);
      const studies = imagesFor(input, def.needs);
      ctx.log(`Reading ${studies.map((s) => s.type).join(" + ")}`);
      const res = await invokeAgent({
        name: def.name,
        slug: def.slug,
        version: prompt.version,
        prompt: prompt.text,
        context: {
          ageYears: input.context.ageYears,
          studies: studies.map((s) => s.type),
          // Real images: boxes as box_2d normalized to the image. The generated seed pano: the 800×400 frame.
          geometry: studies[0]?.image?.mimeType === "image/svg+xml" ? { frame: { width: 800, height: 400 } } : { box_2d: "normalized 0-1000 to the first image" },
        },
        images: studies.flatMap((s) => (s.image ? [s.image] : [])),
        schema: SpecialistRawOutputSchema,
        mock: MOCK_SPECIALISTS[def.name],
        forceMock: input.forceMock,
        host: diagnosticHost(),
        runId: input.runId,
        signal: ctx.signal,
      });
      const data = normalizeOverlays(res.data, studies.find((s) => s.image));
      ctx.log(`${data.findings.length} finding(s)`);
      return { ...specialistBadge(data), result: data.summary, output: data, model: res.model, promptVersion: prompt.version };
    },
  };
}

export const verifierSpec: AgentSpec<ReviewInput, VerifierOutput> = {
  name: "Verifier",
  scope: "Independently re-reads every finding",
  get timeoutMs() { return agentSpecTimeoutMs(90_000); },
  retries: 1,
  skip: (input) => (input.candidates.length ? null : "No findings to verify."),
  async run(input, ctx) {
    const prompt = loadPrompt("verifier");
    ctx.log(`Re-reading ${input.candidates.length} finding(s)`);
    const res = await invokeAgent({
      name: "Verifier",
      slug: "verifier",
      version: prompt.version,
      prompt: prompt.text,
      context: { candidates: input.candidates.map(({ id, teeth, condition, detail }) => ({ id, teeth, condition, detail })) },
      images: input.studies.flatMap((s) => (s.image ? [s.image] : [])),
      schema: VerifierOutputSchema,
      mock: () => mockVerifier(input.candidates),
      forceMock: input.forceMock,
      host: diagnosticHost(),
      runId: input.runId,
      signal: ctx.signal,
    });
    const n = res.data.results.filter((r) => r.confirmed).length;
    return { status: "done", badge: `${n} of ${input.candidates.length} confirmed`, result: res.data.summary, output: res.data, model: res.model, promptVersion: prompt.version };
  },
};

export const skepticSpec: AgentSpec<ReviewInput, SkepticOutput> = {
  name: "Skeptic",
  scope: "Challenges every finding",
  get timeoutMs() { return agentSpecTimeoutMs(90_000); },
  retries: 1,
  skip: (input) => (input.candidates.length ? null : "No findings to challenge."),
  async run(input, ctx) {
    const prompt = loadPrompt("skeptic");
    ctx.log(`Challenging ${input.candidates.length} finding(s)`);
    const res = await invokeAgent({
      name: "Skeptic",
      slug: "skeptic",
      version: prompt.version,
      prompt: prompt.text,
      context: { candidates: input.candidates.map(({ id, teeth, condition, detail, confidence }) => ({ id, teeth, condition, detail, confidence })) },
      images: input.studies.flatMap((s) => (s.image ? [s.image] : [])),
      schema: SkepticOutputSchema,
      mock: () => mockSkeptic(input.candidates),
      forceMock: input.forceMock,
      host: diagnosticHost(),
      runId: input.runId,
      signal: ctx.signal,
    });
    const n = res.data.challenges.length;
    return {
      status: n ? "flag" : "done",
      badge: n ? `Challenged ${n}` : "No challenges",
      result: res.data.summary,
      output: res.data,
      model: res.model,
      promptVersion: prompt.version,
    };
  },
};

export function collectCandidates(outcomes: { name: string; outcome: AgentOutcome }[]): Candidate[] {
  const out: Candidate[] = [];
  let i = 0;
  for (const { name, outcome } of outcomes) {
    if (outcome.status !== "done" && outcome.status !== "flag") continue;
    const data = outcome.output as SpecialistOutput | undefined;
    for (const f of data?.findings ?? []) out.push({ ...f, id: `c${++i}`, reporter: name });
  }
  return out;
}

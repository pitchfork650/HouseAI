import { callJSON, type ImagePart } from "../../llm";
import { loadPrompt } from "../../prompts";
import type { AgentOutcome, AgentSpec } from "../coordinator";
import { RULES, type Condition } from "../../rules/prioritize";
import {
  SkepticOutputSchema,
  SpecialistOutputSchema,
  VerifierOutputSchema,
  type Candidate,
  type SkepticOutput,
  type SpecialistOutput,
  type VerifierOutput,
} from "./schemas";
import { MOCK_SPECIALISTS, mockSkeptic, mockVerifier } from "./mocks";

export type StudyInput = { type: string; image?: ImagePart };

/** Data minimization: agents see only the images plus the minimum context. */
export type DiagnosticInput = {
  studies: StudyInput[];
  context: { ageYears: number | null };
  forceMock: boolean;
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
    timeoutMs: 90_000,
    retries: 1,
    skip: (input) => (imagesFor(input, def.needs).length ? null : SKIP_REASONS[def.name] ?? `No ${def.needs[0]} image uploaded. Nothing else was affected.`),
    async run(input, ctx) {
      const prompt = loadPrompt(def.slug);
      const studies = imagesFor(input, def.needs);
      ctx.log(`Reading ${studies.map((s) => s.type).join(" + ")}`);
      const res = await callJSON({
        agent: def.name,
        promptVersion: prompt.version,
        system: prompt.text,
        prompt: JSON.stringify({ task: "Report findings as JSON.", ageYears: input.context.ageYears, imageFrame: { width: 800, height: 400 }, studies: studies.map((s) => s.type) }),
        images: studies.flatMap((s) => (s.image ? [s.image] : [])),
        schema: SpecialistOutputSchema,
        mock: MOCK_SPECIALISTS[def.name],
        forceMock: input.forceMock,
        signal: ctx.signal,
      });
      ctx.log(`${res.data.findings.length} finding(s)`);
      return { ...specialistBadge(res.data), result: res.data.summary, output: res.data, model: res.model, promptVersion: prompt.version };
    },
  };
}

export const verifierSpec: AgentSpec<ReviewInput, VerifierOutput> = {
  name: "Verifier",
  scope: "Independently re-reads every finding",
  timeoutMs: 90_000,
  retries: 1,
  skip: (input) => (input.candidates.length ? null : "No findings to verify."),
  async run(input, ctx) {
    const prompt = loadPrompt("verifier");
    ctx.log(`Re-reading ${input.candidates.length} finding(s)`);
    const res = await callJSON({
      agent: "Verifier",
      promptVersion: prompt.version,
      system: prompt.text,
      prompt: JSON.stringify({ candidates: input.candidates.map(({ id, teeth, condition, detail }) => ({ id, teeth, condition, detail })) }),
      images: input.studies.flatMap((s) => (s.image ? [s.image] : [])),
      schema: VerifierOutputSchema,
      mock: () => mockVerifier(input.candidates),
      forceMock: input.forceMock,
      signal: ctx.signal,
    });
    const n = res.data.results.filter((r) => r.confirmed).length;
    return { status: "done", badge: `${n} of ${input.candidates.length} confirmed`, result: res.data.summary, output: res.data, model: res.model, promptVersion: prompt.version };
  },
};

export const skepticSpec: AgentSpec<ReviewInput, SkepticOutput> = {
  name: "Skeptic",
  scope: "Challenges every finding",
  timeoutMs: 90_000,
  retries: 1,
  skip: (input) => (input.candidates.length ? null : "No findings to challenge."),
  async run(input, ctx) {
    const prompt = loadPrompt("skeptic");
    ctx.log(`Challenging ${input.candidates.length} finding(s)`);
    const res = await callJSON({
      agent: "Skeptic",
      promptVersion: prompt.version,
      system: prompt.text,
      prompt: JSON.stringify({ candidates: input.candidates.map(({ id, teeth, condition, detail, confidence }) => ({ id, teeth, condition, detail, confidence })) }),
      images: input.studies.flatMap((s) => (s.image ? [s.image] : [])),
      schema: SkepticOutputSchema,
      mock: () => mockSkeptic(input.candidates),
      forceMock: input.forceMock,
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

import type { Priority } from "../priority";

/**
 * Prioritizer rules: a finding's condition → CDT procedure code, duration, priority
 * and imaging prerequisite. Pure and deterministic, so it's unit-tested directly.
 */
export type Condition =
  | "periapical_lesion"
  | "impacted_complete_bony"
  | "impacted_partial_bony"
  | "impacted_soft_tissue"
  | "open_margin"
  | "caries_dentin_interproximal"
  | "caries_enamel"
  | "shade_mismatch";

export const PREREQS = {
  D0220: { code: "D0220", label: "PA film", type: "pa" },
  D0367: { code: "D0367", label: "CBCT", type: "cbct" },
} as const;
export type PrereqCode = keyof typeof PREREQS;

type Rule = {
  priority: Priority;
  visits: number;
  label?: string;
  /** CDT code, may depend on the tooth (e.g. root canal by tooth type). */
  code: (teeth: number[]) => string;
  codeLabel?: (teeth: number[]) => string | undefined;
  /** Total chair minutes for the teeth in one finding row. */
  duration: (teeth: number[]) => number;
  /** Groupable conditions merge teeth from the same reporter into one row (one visit). */
  groupable?: boolean;
  prerequisite?: (ctx: RuleContext) => PrereqCode | undefined;
};

export type RuleContext = { teeth: number[]; challenged: boolean; nearNerveCanal: boolean; agreement: number };

const isMolar = (t: number) => [1, 2, 3, 14, 15, 16, 17, 18, 19, 30, 31, 32].includes(t);
const isPremolar = (t: number) => [4, 5, 12, 13, 20, 21, 28, 29].includes(t);

export const RULES: Record<Condition, Rule> = {
  periapical_lesion: {
    priority: "P1",
    visits: 1,
    code: ([t]) => (isMolar(t) ? "D3330" : isPremolar(t) ? "D3320" : "D3310"),
    codeLabel: ([t]) => (isMolar(t) ? "root canal, molar" : isPremolar(t) ? "root canal, premolar" : "root canal, anterior"),
    duration: ([t]) => (isMolar(t) ? 75 : isPremolar(t) ? 60 : 45),
    // A root-tip finding that isn't unanimous needs a periapical film before treatment.
    prerequisite: (c) => (c.challenged || c.agreement < 3 ? "D0220" : undefined),
  },
  impacted_complete_bony: {
    priority: "P2",
    visits: 1,
    code: () => "D7240",
    duration: () => 60,
    prerequisite: (c) => (c.nearNerveCanal ? "D0367" : undefined),
  },
  impacted_partial_bony: {
    priority: "P2",
    visits: 1,
    code: () => "D7230",
    duration: () => 45,
    prerequisite: (c) => (c.nearNerveCanal ? "D0367" : undefined),
  },
  impacted_soft_tissue: { priority: "P2", visits: 1, code: () => "D7220", duration: () => 30 },
  open_margin: { priority: "P3", visits: 2, code: () => "D2740", codeLabel: () => "new crown", duration: () => 90 },
  caries_dentin_interproximal: {
    priority: "P3",
    visits: 1,
    groupable: true,
    code: () => "D2391",
    duration: (teeth) => 30 + 15 * Math.max(0, teeth.length - 1),
  },
  caries_enamel: { priority: "P4", visits: 1, groupable: true, code: () => "D1206", duration: () => 10 },
  shade_mismatch: { priority: "P4", visits: 1, code: () => "D9972", duration: () => 60 },
};

export type Prioritized = {
  cdtCode: string;
  durationMin: number;
  visits: number;
  priority: Priority;
  prerequisite?: PrereqCode;
  suggested: string;
};

export function prioritize(condition: Condition, ctx: RuleContext): Prioritized {
  const rule = RULES[condition];
  const cdtCode = rule.code(ctx.teeth);
  const durationMin = rule.duration(ctx.teeth);
  const prerequisite = rule.prerequisite?.(ctx);
  const label = rule.codeLabel?.(ctx.teeth);
  const count = rule.groupable && ctx.teeth.length > 1 ? ctx.teeth.length : 1;
  let suggested = cdtCode + (label ? ` ${label}` : "") + (count > 1 ? ` ×${count}` : "") + ` · ${durationMin} min`;
  if (rule.visits > 1) suggested += `, ${rule.visits} visits`;
  else if (count > 1) suggested += ", one visit";
  if (prerequisite) suggested += ` (${PREREQS[prerequisite].code} ${PREREQS[prerequisite].label} first)`;
  return { cdtCode, durationMin, visits: rule.visits, priority: rule.priority, prerequisite, suggested };
}

export function isGroupable(condition: Condition): boolean {
  return !!RULES[condition].groupable;
}

const PRIO_ORDER: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
/** Treatment-plan order: priority first, then longer cases first. */
export function comparePlan(a: { priority: Priority; durationMin: number }, b: { priority: Priority; durationMin: number }) {
  return PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority] || b.durationMin - a.durationMin;
}

/** Short procedure title used for treatment items and appointments. */
export function procedureTitle(cdtCode: string, teeth: number[]): string {
  const t = teeth.map((n) => `#${n}`).join(", ");
  const names: Record<string, string> = {
    D3330: "Root canal", D3320: "Root canal", D3310: "Root canal",
    D7240: "Wisdom tooth removal", D7230: "Wisdom tooth removal", D7220: "Wisdom tooth removal",
    D2740: "Crown", D2391: "Composite", D1206: "Fluoride varnish", D9972: "Whitening",
  };
  return `${names[cdtCode] ?? cdtCode} ${t}`.trim();
}

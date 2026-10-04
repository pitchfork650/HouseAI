import { prisma } from "./db";
import type { OverlayShape } from "./pano";

/** Serializable view models passed from server pages to client components. */
export type AgentView = {
  id: string;
  name: string;
  scope: string;
  status: string;
  badge: string;
  result: string;
  log: { t: string; text: string }[];
  nextAttemptAt: string | null;
  model: string | null;
};

export type FindingView = {
  id: string;
  teeth: number[];
  condition: string;
  text: string;
  agreement: number;
  suggested: string;
  priority: string;
  prerequisite: string | null;
  overlay: OverlayShape[];
  status: string;
};

export type RunView = {
  id: string;
  kind: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown>;
  agents: AgentView[];
  findings: FindingView[];
};

export async function loadRun(id: string): Promise<RunView | null> {
  const r = await prisma.swarmRun.findUnique({
    where: { id },
    include: { agents: { orderBy: { order: "asc" } }, findings: { orderBy: { order: "asc" } } },
  });
  if (!r) return null;
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    summary: (r.summary ?? {}) as Record<string, unknown>,
    agents: r.agents.map((a) => ({
      id: a.id,
      name: a.name,
      scope: a.scope,
      status: a.status,
      badge: a.badge,
      result: a.result,
      log: (a.log ?? []) as AgentView["log"],
      nextAttemptAt: a.nextAttemptAt?.toISOString() ?? null,
      model: a.model,
    })),
    findings: r.findings.map((f) => ({
      id: f.id,
      teeth: f.teeth as number[],
      condition: f.condition,
      text: f.text,
      agreement: f.agreement,
      suggested: f.suggested,
      priority: f.priority,
      prerequisite: f.prerequisite,
      overlay: (f.overlay ?? []) as OverlayShape[],
      status: f.status,
    })),
  };
}

export async function latestRunId(patientId: string, kind: "diagnostic" | "insurance"): Promise<string | null> {
  const r = await prisma.swarmRun.findFirst({ where: { patientId, kind }, orderBy: { startedAt: "desc" }, select: { id: true } });
  return r?.id ?? null;
}

import { prisma } from "../db";
import { audit } from "../audit";
import type { AgentOutcome, LogLine, RunStore } from "./coordinator";
import type { Prisma } from "@prisma/client";

/** Persists agent runs to AgentRun rows and audits every final output. */
export class PrismaRunStore implements RunStore {
  constructor(private runId: string, private inputsForAudit: unknown) {}

  async create(order: number, name: string, scope: string) {
    const row = await prisma.agentRun.create({
      data: { runId: this.runId, order, name, scope, status: "queued", badge: "Queued", log: [] },
    });
    return row.id;
  }

  async update(id: string, patch: { status?: string; badge?: string; log?: LogLine[]; attempts?: number; startedAt?: Date }) {
    await prisma.agentRun.update({ where: { id }, data: { ...patch, log: patch.log as Prisma.InputJsonValue | undefined } });
  }

  async finish(id: string, name: string, o: AgentOutcome, log: LogLine[], attempts: number) {
    await prisma.agentRun.update({
      where: { id },
      data: {
        status: o.status,
        badge: o.badge,
        result: o.result,
        log: log as unknown as Prisma.InputJsonValue,
        output: (o.output ?? undefined) as Prisma.InputJsonValue | undefined,
        model: o.model,
        promptVersion: o.promptVersion,
        attempts,
        nextAttemptAt: o.nextAttemptAt ?? null,
        finishedAt: new Date(),
      },
    });
    await audit({
      actor: name,
      action: `agent.${o.status}`,
      entity: "AgentRun",
      entityId: id,
      inputs: this.inputsForAudit,
      outputs: o.output ?? o.result,
      model: o.model,
      details: { runId: this.runId, badge: o.badge, promptVersion: o.promptVersion ?? null },
    });
  }
}

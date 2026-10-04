import crypto from "node:crypto";
import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export function hash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 32);
}

/** Every agent output and every human accept / reject writes an AuditEvent. */
export async function audit(e: {
  actor: string;
  action: string;
  entity?: string;
  entityId?: string;
  inputs?: unknown;
  outputs?: unknown;
  model?: string | null;
  details?: Prisma.InputJsonValue;
}) {
  await prisma.auditEvent.create({
    data: {
      actor: e.actor,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      inputsHash: e.inputs === undefined ? null : hash(e.inputs),
      outputsHash: e.outputs === undefined ? null : hash(e.outputs),
      model: e.model ?? null,
      details: e.details,
    },
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { CARD_FIELDS } from "@/lib/ocr";

const Body = z.object({ values: z.record(z.string(), z.string().max(120)), rank: z.enum(["primary", "secondary"]).default("primary") });

/** Staff confirm the OCR fields; the card becomes an insurance policy on the record. */
export async function POST(req: Request, ctx: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const scan = await prisma.documentScan.findUnique({ where: { id: scanId } });
  if (!scan?.patientId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const prev = scan.fields as Record<string, { value: string; confidence: number }>;
  const fields = Object.fromEntries(CARD_FIELDS.map((f) => [f, { value: parsed.data.values[f] ?? prev[f]?.value ?? "", confidence: prev[f]?.confidence ?? 0, confirmed: true }]));
  await prisma.documentScan.update({ where: { id: scanId }, data: { fields: fields as Prisma.InputJsonValue, status: "confirmed" } });
  const carrier = fields.carrier.value || "Unknown carrier";
  const existing = await prisma.insurancePolicy.findFirst({ where: { patientId: scan.patientId, carrier } });
  const policy = existing
    ? await prisma.insurancePolicy.update({ where: { id: existing.id }, data: { memberId: fields.memberId.value, groupNumber: fields.groupNumber.value, status: "unverified" } })
    : await prisma.insurancePolicy.create({ data: { patientId: scan.patientId, carrier, planName: carrier, memberId: fields.memberId.value, groupNumber: fields.groupNumber.value, rank: parsed.data.rank, status: "unverified" } });
  const edited = CARD_FIELDS.filter((f) => parsed.data.values[f] !== undefined && parsed.data.values[f] !== prev[f]?.value);
  await audit({ actor: "user:staff", action: "ocr.confirm", entity: "DocumentScan", entityId: scanId, details: { edited, policyId: policy.id } });
  return NextResponse.json({ policyId: policy.id, patientId: scan.patientId });
}

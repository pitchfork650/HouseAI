import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { PREREQS } from "@/lib/rules/prioritize";

const Body = z.object({ code: z.enum(["D0220", "D0367"]), teeth: z.array(z.number().int().min(1).max(32)).min(1) });

export async function POST(req: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  const { code, teeth } = parsed.data;
  const existing = (await prisma.imagingOrder.findMany({ where: { patientId, code, status: "ordered" } })).find((o) => JSON.stringify(o.teeth) === JSON.stringify(teeth));
  const order = existing ?? (await prisma.imagingOrder.create({ data: { patientId, code, type: PREREQS[code].type, teeth } }));
  if (!existing) await audit({ actor: "user:dentist", action: "imaging.order", entity: "ImagingOrder", entityId: order.id, inputs: { code, teeth } });
  return NextResponse.json({ id: order.id, existing: !!existing });
}

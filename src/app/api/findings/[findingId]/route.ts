import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { acceptFindings, rejectFinding } from "@/lib/treatment";

const Body = z.object({ status: z.enum(["accepted", "rejected"]), reason: z.string().optional() });

/** Accept or reject a single finding. Both write an AuditEvent. */
export async function POST(req: Request, ctx: { params: Promise<{ findingId: string }> }) {
  const { findingId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const f = await prisma.finding.findUnique({ where: { id: findingId } });
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (parsed.data.status === "rejected") return NextResponse.json(await rejectFinding(findingId, "user:dentist", parsed.data.reason));
  return NextResponse.json(await acceptFindings(f.runId, "user:dentist", [findingId]));
}
